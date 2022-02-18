//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";

contract VRFConsumerV2 is VRFConsumerBaseV2 {
  event RequestInitialized(uint256 requestId, uint64 subscriptionId);
  event RequestFullfilled(uint256 requestId, uint256[] randomWords);

  VRFCoordinatorV2Interface private COORDINATOR;
  LinkTokenInterface private LINKTOKEN;

  // VRF parameters
  address private vrfCoordinator;
  address private linkTokenAddress;
  bytes32 private keyHash;
  uint32 private callbackGasLimit = 100000;
  uint16 private requestConfirmations = 3;

  // Storage parameters
  uint256[] private randomWords;
  uint256 private requestId;

  constructor() VRFConsumerBaseV2(vrfCoordinator) {
    COORDINATOR = VRFCoordinatorV2Interface(vrfCoordinator);
    LINKTOKEN = LinkTokenInterface(linkTokenAddress);
  }

  /**
   * @notice Requests `_numWords` random numbers
   * Assumes the subscription is funded sufficiently.
   * Will revert if subscription is not set and funded.
   * @param _numWords Number of random numbers
   * @param _subscriptionId ID of the subscription
   */
  function requestRandomWords(uint32 _numWords, uint64 _subscriptionId)
    internal
  {
    requestId = COORDINATOR.requestRandomWords(
      keyHash,
      _subscriptionId,
      requestConfirmations,
      callbackGasLimit,
      _numWords
    );

    emit RequestInitialized(requestId, _subscriptionId);
  }

  /**
   * @notice Fallback function that returns the random numbers
   * @param _randomWords Random generated numbers
   */
  function fulfillRandomWords(
    uint256, /* requestId */
    uint256[] memory _randomWords
  ) internal override {
    randomWords = _randomWords;

    emit RequestFullfilled(requestId, randomWords);
  }

  function _getRandomWords() external view returns (uint256[] memory) {
    return randomWords;
  }

  function _getRandomWord(uint256 _index) external view returns (uint256) {
    return randomWords[_index];
  }
}
