//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "sortition-sum-tree-factory/contracts/SortitionSumTreeFactory.sol";
import "./ControlledToken.sol";

contract Ticket is ControlledToken {
  using SortitionSumTreeFactory for SortitionSumTreeFactory.SortitionSumTrees;

  bytes32 private constant TREE_KEY = keccak256("PryzeProtocol");
  uint256 private constant MAX_TREE_LEAVES = 5;

  SortitionSumTreeFactory.SortitionSumTrees internal sortitionSumTrees;

  constructor(
    string memory _name,
    string memory _symbol,
    address _controller
  ) ControlledToken(_name, _symbol, _controller) {
    require(_controller != address(0), "Ticket: CONTROLLER_NOT_ZERO");
    sortitionSumTrees.createTree(TREE_KEY, MAX_TREE_LEAVES);
  }

  function stakeOf(address _user) external view returns (uint256) {
    return
      sortitionSumTrees.stakeOf(TREE_KEY, bytes32(uint256(uint160(_user))));
  }

  function draw(uint256 _randomNumber) external view returns (address) {
    uint256 bound = totalSupply();
    address selected;
    if (bound == 0) {
      selected = address(0);
    } else {
      selected = address(
        uint160(uint256(sortitionSumTrees.draw(TREE_KEY, _randomNumber)))
      );
    }
    return selected;
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 amount
  ) internal virtual override {
    super._beforeTokenTransfer(from, to, amount);

    if (from == to) {
      return;
    }

    if (from != address(0)) {
      uint256 fromBalance = balanceOf(from) - amount;
      sortitionSumTrees.set(
        TREE_KEY,
        fromBalance,
        bytes32(uint256(uint160(from)))
      );
    }

    if (to != address(0)) {
      uint256 toBalance = balanceOf(to) + amount;
      sortitionSumTrees.set(TREE_KEY, toBalance, bytes32(uint256(uint160(to))));
    }
  }
}
