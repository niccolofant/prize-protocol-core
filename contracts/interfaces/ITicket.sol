//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ITicket {
  function draw(uint256 randomNumber) external view returns (address);

  function stakeOf(address user) external view returns (uint256);
  /*function stakes() external view returns (uint256[] memory);*/
  /*function players() external view returns (address[] memory);*/
}
