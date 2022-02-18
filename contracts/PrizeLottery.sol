//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Counters.sol";
import "./utils/Controller.sol";
import "./randomness/VRFConsumerV2.sol";
import "./token/Ticket.sol";
import "./yield-source-interactor/YieldSourceInteractor.sol";

contract PrizeLottery is Controller {
  using Counters for Counters.Counter;

  string public constant NAME = "Pryze Lottery V1";

  uint256 public constant DURATION = 1 weeks;

  enum State {
    OPEN,
    CLOSED,
    AWARDING_WINNER
  }

  Counters.Counter internal _lotteryId;

  struct Lottery {
    ;
  }

  State public state;

  constructor() Controller(msg.sender) {}

  function _initialize() internal {}

  function depositTo(address _token, uint256 _amount) external {}
}
