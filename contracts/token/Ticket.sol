//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "./ControlledToken.sol";
import "../interfaces/ITicket.sol";

contract Ticket is ITicket, ControlledToken {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  bytes32 private constant TREE_KEY = keccak256("PryzeProtocol");
  uint256 private constant MAX_TREE_LEAVES = 5;

  SortitionSumTreeFactory.SortitionSumTrees internal sortitionSumTrees;

  /**
   * @notice Create the Ticket token contract
   * @param _name The name of the token
   * @param _symbol The symbol of the token
   * @param _controller The controller
   */
  constructor(
    string memory _name,
    string memory _symbol,
    address _controller
  ) ControlledToken(_name, _symbol, _controller) {
    require(_controller != address(0), "Ticket: CONTROLLER_NOT_ZERO");
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
  }

  /**
   * Return the amount of tickets owned by the `user`
   * @param _user Address of the user
   * @return The amount of token owned by the `user`
   */
  function stakeOf(address _user) external view override returns (uint256) {
    return
      sortitionSumTrees.stakeOf(TREE_KEY, bytes32(uint256(uint160(_user))));
  }

  /**
   * Draw an address from a tree using a number.
   * Note that this function reverts if the sum of all values in the tree is 0.
   * @param _number The drawn number
   * @return The address drawn
   */
  function draw(uint256 _number) external view override returns (address) {
    uint256 bound = totalSupply();
    address selected;
    if (bound == 0) {
      selected = address(0);
    } else {
      selected = address(
        uint160(uint256(sortitionSumTrees.draw(TREE_KEY, _number)))
      );
    }
    return selected;
  }

  function _beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _amount
  ) internal virtual override {
    super._beforeTokenTransfer(_from, _to, _amount);

    if (_from == _to) {
      return;
    }

    if (_from != address(0)) {
      uint256 fromBalance = balanceOf(_from) - _amount;
      sortitionSumTrees.set(
        TREE_KEY,
        fromBalance,
        bytes32(uint256(uint160(_from)))
      );
    }

    if (_to != address(0)) {
      uint256 toBalance = balanceOf(_to) + _amount;
      sortitionSumTrees.set(
        TREE_KEY,
        toBalance,
        bytes32(uint256(uint160(_to)))
      );
    }
  }
}
