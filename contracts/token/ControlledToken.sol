//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../utils/Controller.sol";

contract ControlledToken is Controller, ERC20 {
  /**
   * @notice Create a ControlledToken token
   * @param _name The name of the token
   * @param _symbol The symbol of the token
   * @param _controller The address of the controller
   */
  constructor(
    string memory _name,
    string memory _symbol,
    address _controller
  ) Controller(_controller) ERC20(_name, _symbol) {}

  /**
   * @notice Allows the controller to mint `_amount` of tokens
   * to the `_user` address
   * @param _user The address to mint tokens to
   * @param _amount The amount of tokens to mint
   */
  function _controlledMint(address _user, uint256 _amount)
    internal
    onlyController
  {
    _mint(_user, _amount);
  }

  /**
   * @notice Allows the controller to burn `_amount` of tokens
   * from the `_user` address
   * @param _user The address to burn tokens from
   * @param _amount The amount of tokens to burn
   */
  function _controlledBurn(address _user, uint256 _amount)
    internal
    onlyController
  {
    _burn(_user, _amount);
  }
}
