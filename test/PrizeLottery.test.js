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
        DAI_ADDRESS,
        CDAI_ADDRESS
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

  describe("#deposit", async () => {
    let prizeLottery;
    let ticket;
    const player1 = accounts[1];

    // Mints 500 DAI to the player1 address
    mintDai(player1);

    beforeEach(async () => {
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

    it("reverts if the state isn't OPEN", async () => {
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

    it("reverts if the player deposits insufficient token amount", async () => {
      const MINIMUM_DEPOSIT = await prizeLottery.MINIMUM_DEPOSIT();
      const DEPOSIT_AMOUNT = web3.utils.toWei("0.1");
      expect(parseInt(DEPOSIT_AMOUNT)).to.be.below(
        parseInt(MINIMUM_DEPOSIT.toString())
      );
      await expectRevert(
        prizeLottery.deposit(DEPOSIT_AMOUNT),
        "PrizeLottery: INSUFFICIENT_DEPOSIT_AMOUNT"
      );
    });

    it("transfer the deposited amount into the yield protocol (Compound)", async () => {
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");

      // Approve the token transfer from player1 to the lottery contract
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });

      // Check allowance
      const lotteryAllowance = await DAI.methods
        .allowance(player1, prizeLottery.address)
        .call();
      expect(lotteryAllowance.toString()).to.equal(DEPOSIT_AMOUNT);

      await prizeLottery.deposit(DEPOSIT_AMOUNT, { from: player1 });

      // Check lottery balance
      const prizeLotteryDaiBalance = await DAI.methods
        .balanceOf(prizeLottery.address)
        .call();
      expect(prizeLotteryDaiBalance.toString()).to.equal(web3.utils.toWei("0"));

      // Check Compound balance for the lottery contract
      const compoundLotteryBalance =
        await prizeLottery.balanceOfUnderlyingCompound.call(CDAI_ADDRESS);
      expect(parseInt(compoundLotteryBalance.toString())).to.be.above(
        parseInt(web3.utils.toWei("0.9999999"))
      );
    });

    it("mints a number of tickets equal to the amount of tokens deposited by the player", async () => {
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");

      // Approve the token transfer from player1 to the lottery contract
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });

      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });

      // Checks tickets
      const stakeOfPlayer1 = await ticket.stakeOf.call(player1);
      expect(stakeOfPlayer1.toString()).to.equal(DEPOSIT_AMOUNT);
    });
  });

  describe("#prizePool", () => {
    let prizeLottery;
    let ticket;
    const player1 = accounts[1];

    // Mints 500 DAI to the player1 and player2
    mintDai(player1);

    beforeEach(async () => {
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

    it("returns the earned interest of the deposited amount", async () => {
      const DEPOSIT_AMOUNT = web3.utils.toWei("500");

      // Approve the token transfer from player1 to the lottery contract
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });

      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });

      // increase time by 5000 secs
      // await time.increase(5000);

      // in those 5000 secs the amount deposited should
      // have earned a bit of interest
      const prizePool = await prizeLottery.prizePool.call();

      console.log(web3.utils.fromWei(prizePool));
    });
  });
});
