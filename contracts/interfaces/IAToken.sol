//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IAToken is IERC20 {
  function underlyingAssetAddress() external view returns (address);

  function redeem(uint256 amount) external;

  function transfer(address recipient, uint256 amount)
    external
    override
    returns (bool);

  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) external override returns (bool);

  function isTransferAllowed(address user, uint256 amount)
    external
    returns (bool);

  function redirectInterestStream(address to) external;

  function redirectInterestStreamOf(address from, address to) external;

  function allowInterestRedirectionTo(address to) external;

  function balanceOf(address user) external view override returns (uint256);

  function principalBalanceOf(address user) external view returns (uint256);

  function getInterestRedirectionAddress(address user)
    external
    view
    returns (address);
}
