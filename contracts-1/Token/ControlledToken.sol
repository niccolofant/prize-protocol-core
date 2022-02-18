//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ControlledToken is ERC20 {
  address public controller;

  constructor(
    string memory _name,
    string memory _symbol,
    address _controller
  ) ERC20(_name, _symbol) {
    controller = _controller;
  }

  function _controlledMint(address _user, uint256 _amount)
    internal
    onlyController
  {
    _mint(_user, _amount);
  }

  function _controlledBurn(address _user, uint256 _amount)
    internal
    onlyController
  {
    _burn(_user, _amount);
  }

  modifier onlyController() {
    require(
      msg.sender == address(controller),
      "ControlledToken: ONLY_CONTROLLER"
    );
    _;
  }
}
