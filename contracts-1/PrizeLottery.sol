//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Token/Ticket.sol";
import "./Compound/ICToken.sol";
import "./Compound/CYieldSource.sol";

import "./Randomness/VRFConsumerV2.sol";

contract PrizeLottery is Ownable, CYieldSource, VRFConsumerV2 {
  using Counters for Counters.Counter;

  string public constant NAME = "USDC Prize Lottery";

  address public constant USDC_TOKEN =
    0xeb8f08a975Ab53E34D8a0330E0D34de942C95926;

  address public cToken;

  Ticket public ticket;

  Counters.Counter public lotteryId;

  constructor(address _cToken, address _ticketAddr) {
    cToken = _cToken;
    ticket = Ticket(_ticketAddr);
  }

  function deposit(uint256 _amount) external {
    _supply(IERC20(USDC_TOKEN), ICToken(cToken), _amount);
  }

  function calculateWinner()
}
