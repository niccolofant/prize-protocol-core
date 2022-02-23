//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "../utils/Controller.sol";

contract VRFConsumerV2 is Controller, VRFConsumerBaseV2 {
  event RandomWordsRequested(
    uint64 indexed subscriptionId,
    uint256 indexed requestId
  );
  event RandomWordsReceived(
    uint64 indexed subscriptionId,
    uint256 indexed requestId,
    uint256[] randomWords
  );

  VRFCoordinatorV2Interface internal VRF_COORDINATOR;
  LinkTokenInterface internal LINK_TOKEN;

  uint64 internal subscriptionId;
  address internal vrfCoordinator;
  address internal link;
  bytes32 internal keyHash;

  uint256[] public randomWords;
  uint256 public requestId;

  constructor(
    address _controller,
    uint64 _subscriptionId,
    address _vrfCoordinator,
    address _link,
    bytes32 _keyHash
  ) Controller(_controller) VRFConsumerBaseV2(_vrfCoordinator) {
    VRF_COORDINATOR = VRFCoordinatorV2Interface(_vrfCoordinator);
    LINK_TOKEN = LinkTokenInterface(_link);
    subscriptionId = _subscriptionId;
    vrfCoordinator = _vrfCoordinator;
    link = _link;
    keyHash = _keyHash;
  }

  function requestRandomWords(
    uint16 _requestConfirmations,
    uint32 _callbackGasLimit,
    uint32 _numWords
  ) external onlyController {
    require(_numWords <= 500, "VRFConsumerV2: MAX_WORDS_NUMBER_REACHED");
    requestId = VRF_COORDINATOR.requestRandomWords(
      keyHash,
      subscriptionId,
      _requestConfirmations,
      _callbackGasLimit,
      _numWords
    );

    emit RandomWordsRequested(subscriptionId, requestId);
  }

  function fulfillRandomWords(
    uint256, /* requestId */
    uint256[] memory _randomWords
  ) internal override {
    randomWords = _randomWords;

    emit RandomWordsReceived(subscriptionId, requestId, randomWords);
  }

  function getRandomWords() external view returns (uint256[] memory) {
    return randomWords;
  }

  function getRandomWord(uint256 _index) external view returns (uint256) {
    return randomWords[_index];
  }
}
