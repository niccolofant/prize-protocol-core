const {
  expectRevert,
  time,
  expectEvent,
} = require("@openzeppelin/test-helpers");

const PrizeLottery = artifacts.require("PrizeLottery");
const Ticket = artifacts.require("Ticket");

const TokensAddress = require("../utils/erc20Tokens.json");

const mintDai = require("../scripts/mintDai");

const IERC20 = require("../build/IERC20.json");
const ICToken = require("../build/ICToken.json");

contract("PrizeLottery", (accounts) => {
  const TICKET_NAME = "Ticket";
  const TICKET_SYMBOL = "TKT";
  const OWNER = accounts[0];
  const TOKENS_ADDRESS = TokensAddress["mainnet"];

  const DAI_ADDRESS = TOKENS_ADDRESS.dai;
  const DAI = new web3.eth.Contract(IERC20.abi, DAI_ADDRESS);

  const CDAI_ADDRESS = TOKENS_ADDRESS.cDai;
  const CDAI = new web3.eth.Contract(ICToken.abi, CDAI_ADDRESS);

  describe("#_initialize", () => {
    let prizeLottery;
    let ticket;
    let latestTimestamp;

    before(async () => {
      ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
      prizeLottery = await PrizeLottery.new(
        ticket.address,
        TOKENS_ADDRESS.dai,
        TOKENS_ADDRESS.cDai
      );
      latestTimestamp = await time.latest();
      await ticket.transferControllerRole(prizeLottery.address, {
        from: OWNER,
      });
    });

    it("sets the state to OPEN", async () => {
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");
    });

    it("sets the lottery start to the current block timestamp", async () => {
      const lotteryStart = await prizeLottery.lotteryStart();
      expect(lotteryStart.toString()).to.equal(latestTimestamp.toString());
    });

    it("sets the lottery ID to the correct ID", async () => {
      const lotteryId = await prizeLottery.lotteryId();
      expect(lotteryId.toString()).to.equal("1");
    });

    /*
    it("transfers any reserve into the yield protocol (Compound)", async () => {
      // Required to call `_initialize` again
      await prizeLottery.changeState("2");
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("2");

      // Mint 500 DAI
      mintDai(prizeLottery.address);
      const prizeLotteryDaiBalanceBefore = await DAI.methods
        .balanceOf(prizeLottery.address)
        .call();
      expect(prizeLotteryDaiBalanceBefore.toString()).to.equal(
        web3.utils.toWei("500")
      );

      // CHECK TEST
      const stakeOfLottery = await ticket.stakeOf.call(prizeLottery.address);
      console.log(stakeOfLottery.toString());

      const controller = await prizeLottery.controller();
      console.log(prizeLottery.address);
      console.log(controller.toString());

      // Check if the reserve is transferred into the yield protocol

      await prizeLottery._initialize({ from: prizeLottery.address });
      const prizeLotteryDaiBalanceAfter = await DAI.methods
        .balanceOf(prizeLottery.address)
        .call();
      expect(prizeLotteryDaiBalanceAfter.toString()).to.equal(
        web3.utils.toWei("0")
      );
    });
    */
  });

  describe("#deposit", () => {
    let prizeLottery;
    let ticket;

    before(async () => {
      ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
      prizeLottery = await PrizeLottery.new(
        ticket.address,
        TOKENS_ADDRESS.dai,
        TOKENS_ADDRESS.cDai
      );
      await ticket.transferControllerRole(prizeLottery.address, {
        from: OWNER,
      });
    });

    it("reverts if state isn't OPEN", async () => {
      // State.CLOSED
      await prizeLottery.changeState("2");
      await expectRevert(
        prizeLottery.deposit(web3.utils.toWei("0")),
        "PrizeLottery: REQUIRE_STATE_OPEN"
      );
      // State.AWARDING_WINNER
      await prizeLottery.changeState("1");
      await expectRevert(
        prizeLottery.deposit(web3.utils.toWei("0")),
        "PrizeLottery: REQUIRE_STATE_OPEN"
      );
    });

    it("reverts if the player deposit insufficient tokens", async () => {
      const MINIMUM_DEPOSIT = await prizeLottery.MINIMUM_DEPOSIT();
      const depositAmount = web3.utils.toWei("0.1");
      expect(depositAmount.toFixed()).to.be.below(MINIMUM_DEPOSIT.toFixed());
    });
  });
});
