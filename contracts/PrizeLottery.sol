//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/ICToken.sol";
import "./utils/Controller.sol";
import "./randomness/VRFConsumerV2.sol";
import "./token/Ticket.sol";
import "./yield-source-interactor/YieldSourceInteractor.sol";

contract PrizeLottery is Controller, Ownable, YieldSourceInteractor {
  using Counters for Counters.Counter;

  event LotteryStarted(uint256 lotteryId, IERC20 token, ICToken cToken);

  event Winner(uint256 lotteryId, address user, uint256 amount);

  string public constant NAME = "Prize Lottery V1";

  uint256 public constant DRAWING_PERIOD = 10 days;

  uint256 public constant MINIMUM_DEPOSIT = 1e18; // 1

  enum State {
    OPEN,
    AWARDING_WINNER,
    CLOSED
  }

  Counters.Counter internal _lotteryId;

  State public state;

  uint256 public lotteryStart;
  uint256 public lotteryEnd;

  Ticket public ticket;

  IERC20 public token;

  ICToken public cToken;

  VRFConsumerV2 internal vrfConsumer;

  constructor(
    address _ticket,
    address _token,
    address _cToken,
    address _vrfConsumer
  ) YieldSourceInteractor(address(this)) {
    ticket = Ticket(_ticket);
    token = IERC20(_token);
    cToken = ICToken(_cToken);
    vrfConsumer = VRFConsumerV2(_vrfConsumer);

    _initialize();
  }

  function _initialize() internal {
    require(
      keccak256(abi.encodePacked(state)) ==
        keccak256(abi.encodePacked(State.CLOSED))
    );

    uint256 reserve = token.balanceOf(address(this));

    if (reserve > 0) {
      require(
        _supplyToCompound(address(token), address(cToken), reserve) == 0,
        "PrizeLottery: SUPPLY_FAILED"
      );
    }

    lotteryStart = block.timestamp;
    lotteryEnd = lotteryStart + DRAWING_PERIOD;

    _lotteryId.increment();

    state = State.OPEN;

    emit LotteryStarted(_lotteryId.current(), token, cToken);
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

    require(_amount >= MINIMUM_DEPOSIT, "PrizeLottery: INSUFFICIENT_DEPOSIT");

    IERC20(token).transferFrom(_msgSender(), address(this), _amount);

    require(
      _supplyToCompound(address(token), address(cToken), _amount) == 0,
      "PrizeLottery: SUPPLY_FAILED"
    );

    ticket.controlledMint(_msgSender(), _amount);

    return (
      bytes32(uint256(uint160(_msgSender()))),
      ticket.stakeOf(_msgSender())
    );
  }

  /**
   * @notice Allow the msg.sender to converts cTokens into a specified
   * quantity of the underlying asset, and returns them to the msg.sender
   * @param _tokenAmount The amount of underlying to be redeemed
   * @return The ID of the user (msg.sender) and the amount of tickets he has
   * on that moment
   */
  function redeemUnderlying(uint256 _tokenAmount)
    external
    returns (bytes32, uint256)
  {
    require(
      _tokenAmount <= ticket.stakeOf(_msgSender()),
      "PrizeLottery: INSUFFICIENT_FUNDS"
    );

    ticket.controlledBurn(_msgSender(), _tokenAmount);

    require(
      _redeemUnderlyingFromCompound(address(cToken), _tokenAmount) == 0,
      "PrizeLottery: REDEEM_FAILED"
    );

    token.transfer(_msgSender(), _tokenAmount);

    return (
      bytes32(uint256(uint160(_msgSender()))),
      ticket.stakeOf(_msgSender())
    );
  }

  function draw(uint256 _randomNumber) external onlyOwner {
    require(
      block.timestamp - lotteryStart >= DRAWING_PERIOD,
      "PrizeLottery: CANNOT_DRAW_YET"
    );

    lotteryEnd = block.timestamp;

    state = State.AWARDING_WINNER;

    address winner = ticket.draw(_randomNumber);

    uint256 prize = prizePool();

    ticket.controlledMint(winner, prize);

    emit Winner(_lotteryId.current(), winner, prize);
  }

  function prizePool() public returns (uint256) {
    uint256 depositedAmount = ticket.totalSupply();
    uint256 totalAmount = balanceOfUnderlyingCompound(address(cToken));

    uint256 prize = totalAmount - depositedAmount;

    require(prize >= 0);

    return prize;
  }
}
