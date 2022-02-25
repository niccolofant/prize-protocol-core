//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/*                                                                
_________   _...._              .--.                __.....__      
\        |.'      '-.           |__|            .-''         '.    
 \        .'```'.    '. .-,.--. .--.           /     .-''"'-.  `.  
  \      |       \     \|  .-. ||  |          /     /________\   \ 
   |     |        |    || |  | ||  |.--------.|                  | 
   |      \      /    . | |  | ||  ||____    |\    .-------------' 
   |     |\`'-.-'   .'  | |  '- |  |    /   /  \    '-.____...---. 
   |     | '-....-'`    | |     |__|  .'   /    `.             .'  
  .'     '.             | |          /    /___    `''-...... -'    
'-----------'           |_|         |         |                    
                                    |_________|                    
*/

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "./interfaces/ICToken.sol";
import "./utils/Controller.sol";
import "./token/Ticket.sol";
import "./yield-source-interactor/CompoundYieldSourceInteractor.sol";

contract PrizeLottery is
  Controller,
  Ownable,
  CompoundYieldSourceInteractor,
  KeeperCompatibleInterface,
  VRFConsumerBaseV2
{
  using Counters for Counters.Counter;

  /* Lottery parameters */
  uint256 public constant DRAWING_PERIOD = 10 days;
  uint256 public constant MINIMUM_DEPOSIT = 1e18; // 1

  enum State {
    OPEN,
    AWARDING_WINNER,
    CLOSED
  }

  /* Lottery parameters */
  string public name;
  Counters.Counter public lotteryId;
  State public state;
  uint256 public lotteryStart;
  uint256 public lotteryEnd;

  /* Tokens */
  Ticket internal ticket;
  IERC20 internal token;
  ICToken internal cToken;

  /* Chainlink VRF parameters */
  uint16 internal constant REQUEST_CONFIRMATIONS = 3;
  uint32 internal constant NUM_WORDS = 1;
  uint32 internal constant CALLBACK_GAS_LIMIT = 200000;

  /* Chainlink VRF parameters */
  VRFCoordinatorV2Interface internal immutable vrfCoordinator;
  uint64 internal immutable subscriptionId;
  bytes32 internal immutable keyHash;

  /* Events */
  event LotteryStarted(uint256 indexed lotteryId, IERC20 token, ICToken cToken);
  event PlayerDeposited(
    uint256 indexed lotteryId,
    address indexed player,
    uint256 amount
  );
  event UnderlyingAssetRedeemed(
    uint256 indexed lotteryId,
    address indexed player,
    uint256 amount
  );
  event LotteryWinnerRequested(
    uint256 indexed lotteryId,
    uint64 subscriptionId,
    uint256 requestId
  );
  event LotteryWinnerAwarded(
    uint256 indexed lotteryId,
    address indexed player,
    uint256 amount
  );
  event StateChanged(uint256 indexed lotteryId, State oldState, State newState);

  constructor(
    string memory _name,
    address _ticket,
    address _token,
    address _cToken,
    uint64 _subscriptionId,
    address _vrfCoordinator,
    bytes32 _keyHash
  )
    CompoundYieldSourceInteractor(address(this))
    VRFConsumerBaseV2(_vrfCoordinator)
  {
    name = _name;
    ticket = Ticket(_ticket);
    token = IERC20(_token);
    cToken = ICToken(_cToken);
    vrfCoordinator = VRFCoordinatorV2Interface(_vrfCoordinator);
    subscriptionId = _subscriptionId;
    keyHash = _keyHash;

    state = State.CLOSED;

    _initialize();
  }

  function _initialize() internal {
    require(
      keccak256(abi.encodePacked(state)) !=
        keccak256(abi.encodePacked(State.OPEN)),
      "PrizeLottery: REQUIRE_STATE_NOT_OPEN"
    );

    uint256 reserve = token.balanceOf(address(this));

    if (reserve > 0) {
      require(
        _supplyToCompound(address(token), address(cToken), reserve) == 0,
        "PrizeLottery: SUPPLY_FAILED"
      );
    }

    lotteryStart = block.timestamp;
    lotteryEnd = 0;
    lotteryId.increment();
    state = State.OPEN;

    emit LotteryStarted(lotteryId.current(), token, cToken);
  }

  /**
   * @notice Allows the msg.sender to deposit tokens and join the lottery
   * for the chance of winning. The amount of tokens deposited is transferred
   * into a yield protocol (Compound) and a corresponding number of tickets
   * is minted for the msg.sender. (1 ticket for each token deposited)
   * @param _amount The amount of tokens deposited
   * @return The ID of the user (msg.sender) and the amount of tickets he has
   * on that moment
   */
  function deposit(uint256 _amount) external returns (bytes32, uint256) {
    require(
      keccak256(abi.encodePacked(state)) ==
        keccak256(abi.encodePacked(State.OPEN)),
      "PrizeLottery: REQUIRE_STATE_OPEN"
    );

    require(
      _amount >= MINIMUM_DEPOSIT,
      "PrizeLottery: INSUFFICIENT_DEPOSIT_AMOUNT"
    );

    IERC20(token).transferFrom(_msgSender(), address(this), _amount);

    require(
      _supplyToCompound(address(token), address(cToken), _amount) == 0,
      "PrizeLottery: SUPPLY_FAILED"
    );

    ticket.controlledMint(_msgSender(), _amount);

    emit PlayerDeposited(lotteryId.current(), _msgSender(), _amount);

    return (
      bytes32(uint256(uint160(_msgSender()))),
      ticket.stakeOf(_msgSender())
    );
  }

  /**
   * @notice Allow the msg.sender to converts cTokens into a specified
   * quantity of the underlying asset, and returns them to the msg.sender
   * @param _tokenAmount The amount of underlying to be redeemed
   * @return The amount of tickets the caller has
   */
  function redeem(uint256 _tokenAmount) external returns (uint256) {
    require(
      _tokenAmount <= ticket.stakeOf(_msgSender()),
      "PrizeLottery: INSUFFICIENT_FUNDS_TO_REDEEM"
    );

    require(
      keccak256(abi.encodePacked(state)) !=
        keccak256(abi.encodePacked(State.AWARDING_WINNER)),
      "PrizeLottery: REQUIRE_STATE_NOT_AWARDING_WINNER"
    );

    require(
      _redeemUnderlyingFromCompound(address(cToken), _tokenAmount) == 0,
      "PrizeLottery: REDEEM_FAILED"
    );

    ticket.controlledBurn(_msgSender(), _tokenAmount);
    token.transfer(_msgSender(), _tokenAmount);

    emit UnderlyingAssetRedeemed(
      lotteryId.current(),
      _msgSender(),
      _tokenAmount
    );

    return (ticket.stakeOf(_msgSender()));
  }

  /**
   * @notice Function that calls the Chainlink VRF to get a random number.
   */
  function requestRandomWords() internal {
    require(
      keccak256(abi.encodePacked(state)) ==
        keccak256(abi.encodePacked(State.AWARDING_WINNER)),
      "PrizeLottery: REQUIRE_STATE_AWARDING_WINNER"
    );

    uint256 requestId = vrfCoordinator.requestRandomWords(
      keyHash,
      subscriptionId,
      REQUEST_CONFIRMATIONS,
      CALLBACK_GAS_LIMIT,
      NUM_WORDS
    );

    emit LotteryWinnerRequested(lotteryId.current(), subscriptionId, requestId);
  }

  /**
   * @notice Function that Chainlink VRF node calls when a random number is generated.
   * @param _randomWords Array containing `NUM_WORDS` random generated numbers
   */
  function fulfillRandomWords(
    uint256, /* requestId */
    uint256[] memory _randomWords
  ) internal override {
    _draw(_randomWords[0]);
    _initialize();
  }

  /**
   * @notice Function that, given a random generated number, picks an
   * address and decrees it as the winner.
   * @param _randomNumber The random number generated by the Chainlink VRF
   */
  function _draw(uint256 _randomNumber) internal {
    address pickedWinner = ticket.draw(_randomNumber);

    require(isPickValid(pickedWinner), "PrizeLottery: PICK_NOT_VALID");

    lotteryEnd = block.timestamp;
    uint256 prize = prizePool();
    ticket.controlledMint(pickedWinner, prize);

    emit LotteryWinnerAwarded(lotteryId.current(), pickedWinner, prize);
  }

  /**
   * @notice This is the function that the Chainlink Keeper nodes call
   * they look for `upkeepNeeded` to return True.
   * the following should be true for this to return true:
   * 1. The time interval has passed between lottery runs
   * 2. The lottery is open
   * 3. The lottery is not empty
   * @return upkeepNeeded True if the lottery is ready to draw, otherwise False
   */
  function checkUpkeep(
    bytes memory /* checkData */
  )
    public
    view
    override
    returns (
      bool upkeepNeeded,
      bytes memory /* performData */
    )
  {
    bool isOpen = State.OPEN == state;
    bool timePassed = ((block.timestamp - lotteryStart) >= DRAWING_PERIOD);

    upkeepNeeded = (timePassed && isOpen && !isLotteryEmpty());
  }

  /**
   * @notice Once `checkUpkeep` is returning `true`, this function is called
   * and it kicks off a Chainlink VRF call to get a random winner.
   * ADD VRF AND MOVE `_DRAW` AND `_INTIALIZE` INSIDE THE CALLBACK FUNCTION
   */
  function performUpkeep(
    bytes calldata /* performData */
  ) external override {
    (bool upkeepNeeded, ) = checkUpkeep("0x");

    require(upkeepNeeded, "PrizeLottery: UPKEEP_NOT_NEEDED");

    state = State.AWARDING_WINNER;

    requestRandomWords();
  }

  /**
   * @notice Utility function used to retrieve the current prize pool
   * @return The current prize pool
   */
  function prizePool() public returns (uint256) {
    uint256 depositedAmount = ticket.totalSupply();
    uint256 totalAmount = balanceOfUnderlyingCompound(address(cToken));

    uint256 prize = (totalAmount < depositedAmount)
      ? type(uint256).min
      : (totalAmount - depositedAmount);

    return prize;
  }

  /**
   * @notice Utility function that allows the owner to change the lottery state.
   * @param _state The new state
   */
  function changeState(State _state) external onlyOwner {
    if (_state == state) return;
    State oldState = state;
    state = _state;

    emit StateChanged(lotteryId.current(), oldState, state);
  }

  /**
   * @notice Utility function that checks if the a certain address picked is valid.
   * To be valid it needs to:
   * 1. Not be the zero address
   * 2. be an address of a played that deposited and joined the lottery
   * @param _playerPicked The address that needs to be checked
   * @return True if the address is valid, otherwise False
   */
  function isPickValid(address _playerPicked) public view returns (bool) {
    if (
      _playerPicked == address(0) ||
      ticket.stakeOf(_playerPicked) == type(uint256).min
    ) return false;
    return true;
  }

  /**
   * @notice Utility function that checks if the lottery is empty or not.
   * @return True if the lottery is empty, otherwise False
   */
  function isLotteryEmpty() public view returns (bool) {
    if (ticket.totalSupply() > 0) return false;
    return true;
  }
}
