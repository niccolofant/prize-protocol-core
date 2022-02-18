//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Controller {
  event ControllerRoleTransferred(
    address indexed oldController,
    address indexed newController
  );

  address private _controller;

  constructor(address _currentController) {
    _transferControllerRole(_currentController);
  }

  function controller() public view virtual returns (address) {
    return _controller;
  }

  function transferControllerRole(address _newController)
    public
    virtual
    onlyController
  {
    require(
      _newController != address(0),
      "Controller: CONTROLLER_IS_ZERO_ADDRESS"
    );
    _transferControllerRole(_newController);
  }

  function _transferControllerRole(address _newController) internal virtual {
    address oldController = _controller;
    _controller = _newController;

    emit ControllerRoleTransferred(oldController, _newController);
  }

  modifier onlyController() {
    require(controller() == msg.sender, "Controller: CALLER_IS_NOT_CONTROLLER");
    _;
  }
}
