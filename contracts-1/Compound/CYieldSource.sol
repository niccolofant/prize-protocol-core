//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ICToken.sol";

contract CYieldSource {
  /**
   * @notice Supplies asset tokens to Compound
   * @param _token The token to supply
   * @param _cToken The corresponding cToken
   * @param _amount The amount of tokens to supply
   * @return The result of the minting
   */
  function _supply(
    IERC20 _token,
    ICToken _cToken,
    uint256 _amount
  ) internal returns (uint256) {
    _token.approve(address(_cToken), _amount);
    uint256 mintResult = _cToken.mint(_amount);
    require(mintResult != 0, "CYieldSource: MINT_FAILED");

    return mintResult;
  }

  function _redeem(
    IERC20 _token,
    ICToken _cToken,
    uint256 _amount
  ) internal returns (uint256) {
    uint256 tokenBalanceBefore = _token.balanceOf(address(this));
    require(
      _cToken.redeemUnderlying(_amount) == 0,
      "CYieldSource: REDEEM_FAILED"
    );
    uint256 tokenDiff = tokenBalanceBefore - _token.balanceOf(address(this));

    return tokenDiff;
  }
}
