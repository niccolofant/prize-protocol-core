//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface IPrizeLottery {
  function requestRandomWords(uint32 numWords, uint64 subscriptionId) external;

  function depositTo(
    address to,
    address token,
    address aToken,
    uint256 amount
  ) external view returns (uint256);

  function _award(address user, uint256 amount) external view returns (uint256);

  function redeem(uint256 amount) external view returns (uint256);
}
