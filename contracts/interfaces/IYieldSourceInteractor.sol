//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

/**
 * @dev Allows a contract to interact with different Yield sources.
 * supported sources are, at the moment, Compound and Aave.
 */
interface IYieldSourceInteractor {
  event SuppliedToAave(
    address indexed token,
    address indexed aaveLendingPool,
    uint256 amount
  );
  event RedeemedUnderlyingFromAave(
    address indexed token,
    address indexed aaveLendingPool,
    uint256 tokenAmount
  );

  function supplyToCompound(
    address _token,
    address _cToken,
    uint256 _amount
  ) external returns (uint256);

  function redeemFromCompound(address _cToken, uint256 _cTokenAmount)
    external
    returns (uint256);

  function redeemUnderlyingFromCompound(address _cToken, uint256 _tokenAmount)
    external
    returns (uint256);

  function balanceOfUnderlyingCompound(address _cToken)
    external
    returns (uint256);

  function supplyRatePerBlockCompound(address _cToken)
    external
    returns (uint256);

  function exchangeRateCompound(address _cToken) external returns (uint256);

  /*
  function supplyToAave(
    address _token,
    address _aaveLendingPool,
    uint256 _amount
  ) external returns (uint256);

  function redeemUnderlyingFromAave(
    address _token,
    address _aaveLendingPool,
    uint256 _tokenAmount
  ) external returns (uint256);

  function apyAave(address _aaveLendingPool) external view returns (uint256);
  */
}
