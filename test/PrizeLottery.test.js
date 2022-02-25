const {
  BN,
  expectRevert,
  time,
  expectEvent,
} = require("@openzeppelin/test-helpers");

const PrizeLottery = artifacts.require("CompoundPrizeLotteryTest");
const Ticket = artifacts.require("Ticket");

const TokensAddress = require("../utils/erc20Tokens.json");

const mintDai = require("../scripts/mintDai");

const IERC20 = require("../build/IERC20.json");

contract("PrizeLottery", (accounts) => {
  const TICKET_NAME = "Ticket";
  const TICKET_SYMBOL = "TKT";
  const OWNER = accounts[0];
  const TOKENS_ADDRESS = TokensAddress["mainnet"];

  const DAI_ADDRESS = TOKENS_ADDRESS.dai;
  const DAI = new web3.eth.Contract(IERC20.abi, DAI_ADDRESS);

  const CDAI_ADDRESS = TOKENS_ADDRESS.cDai;

  describe("#initialize", () => {
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

    it("sets the lottery start timestamp to the current block timestamp", async () => {
      const lotteryStart = await prizeLottery.lotteryStart();
      expect(lotteryStart.toString()).to.equal(latestTimestamp.toString());
    });

    it("sets the lottery end timestamp to 0", async () => {
      const lotteryEnd = await prizeLottery.lotteryEnd();
      expect(lotteryEnd.toString()).to.equal("0");
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
        DAI_ADDRESS,
        CDAI_ADDRESS
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

    it("emits a `PlayerDeposited` event", async () => {
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      const depositTxReceipt = await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      const lotteryId = await prizeLottery.lotteryId();

      expectEvent(depositTxReceipt, "PlayerDeposited", {
        lotteryId: lotteryId.toString(),
        player: player1,
        amount: DEPOSIT_AMOUNT,
      });
    });
  });

  describe("#redeem", () => {
    let prizeLottery;
    let ticket;
    const player1 = accounts[1];
    const player2 = accounts[2];
    const DEPOSIT_AMOUNT = web3.utils.toWei("10");

    mintDai(player1);
    mintDai(player2);

    beforeEach(async () => {
      ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
      prizeLottery = await PrizeLottery.new(
        ticket.address,
        DAI_ADDRESS,
        CDAI_ADDRESS
      );
      lotteryStartTimestamp = await prizeLottery.lotteryStart();
      await ticket.transferControllerRole(prizeLottery.address, {
        from: OWNER,
      });
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player2,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player2,
      });
    });

    it("reverts if the player tries to redeem more tokens than he currently has", async () => {
      const REDEEM_AMOUNT = web3.utils.toWei("11");
      await expectRevert(
        prizeLottery.redeem(REDEEM_AMOUNT, { from: player1 }),
        "PrizeLottery: INSUFFICIENT_FUNDS_TO_REDEEM"
      );
    });

    it("reverts if it's called when the state is AWARDING_WINNER", async () => {
      const REDEEM_AMOUNT = web3.utils.toWei("10");
      await prizeLottery.changeState("1");
      await expectRevert(
        prizeLottery.redeem(REDEEM_AMOUNT, { from: player1 }),
        "PrizeLottery: REQUIRE_STATE_NOT_AWARDING_WINNER"
      );
    });

    it("redeems assets from the yield protocol", async () => {
      const player1InitialBalance = new BN(
        await DAI.methods.balanceOf(player1).call()
      );
      const REDEEM_AMOUNT = web3.utils.toWei("10");
      await prizeLottery.redeem(REDEEM_AMOUNT, { from: player1 });

      // check amount of tokens still in the yield protocol
      const protocolBalance =
        await prizeLottery.balanceOfUnderlyingCompound.call(CDAI_ADDRESS);
      expect(parseInt(protocolBalance.toString())).to.be.below(
        parseInt(web3.utils.toWei("20"))
      );
      expect(parseInt(protocolBalance.toString())).to.be.at.least(
        parseInt(web3.utils.toWei("10"))
      );

      // check player1 balance
      const player1FinalBalance = new BN(
        await DAI.methods.balanceOf(player1).call()
      );
      expect(player1FinalBalance.toString()).to.equal(
        player1InitialBalance.add(new BN(web3.utils.toWei("10"))).toString()
      );
    });

    it("burns the same amount of tickets as the amount of tokens redeemed", async () => {
      let player1InitialTicketBalance = new BN(await ticket.stakeOf(player1));
      const REDEEM_AMOUNT = web3.utils.toWei("5");
      await prizeLottery.redeem(REDEEM_AMOUNT, { from: player1 });
      let player1FinalTicketBalance = new BN(await ticket.stakeOf(player1));
      expect(player1FinalTicketBalance.toString()).to.equal(
        player1InitialTicketBalance.sub(new BN(REDEEM_AMOUNT)).toString()
      );
      player1InitialTicketBalance = new BN(await ticket.stakeOf(player1));
      await prizeLottery.redeem(REDEEM_AMOUNT, { from: player1 });
      player1FinalTicketBalance = new BN(await ticket.stakeOf(player1));
      expect(player1FinalTicketBalance.toString()).to.equal("0");
    });

    it("emits a `UnderlyingAssetRedeemed` event", async () => {
      const REDEEM_AMOUNT = web3.utils.toWei("5");
      const redeemReceipt = await prizeLottery.redeem(REDEEM_AMOUNT, {
        from: player1,
      });
      const lotteryId = await prizeLottery.lotteryId();
      expectEvent(redeemReceipt, "UnderlyingAssetRedeemed", {
        lotteryId: lotteryId.toString(),
        player: player1,
        amount: REDEEM_AMOUNT,
      });
    });
  });

  describe("#draw", () => {
    let prizeLottery;
    let ticket;
    let lotteryStartTimestamp;
    const player1 = accounts[1];

    mintDai(player1);

    beforeEach(async () => {
      ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
      prizeLottery = await PrizeLottery.new(
        ticket.address,
        DAI_ADDRESS,
        CDAI_ADDRESS
      );
      lotteryStartTimestamp = await prizeLottery.lotteryStart();
      await ticket.transferControllerRole(prizeLottery.address, {
        from: OWNER,
      });
    });

    it("reverts if upkeep is not needed", async () => {
      // state should be Close
      await prizeLottery.changeState("2");
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("2");

      // enough time should not have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.below(LOTTERY_LENGTH);

      // check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.false;

      const RANDOM_NUMBER = "135432";

      await expectRevert(
        prizeLottery._draw(RANDOM_NUMBER),
        "PrizeLottery: CANNOT_DRAW"
      );
    });

    it("sets the lottery end timestamp to the current block timestamp", async () => {
      // state should be Open
      let state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");

      // enough time should have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      await time.increase(LOTTERY_LENGTH);
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);

      // lottery should not be empty
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      const isLotteryEmpty = await prizeLottery.isLotteryEmpty();
      expect(isLotteryEmpty).to.be.false;

      // check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.true;

      const RANDOM_NUMBER = "135432";
      await prizeLottery._draw(RANDOM_NUMBER);

      // should set the current timestamp as the lottery end
      const currentEndTimestamp = await time.latest();
      const lotteryEndTimestamp = await prizeLottery.lotteryEnd();
      expect(
        parseInt(lotteryEndTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);
      expect(lotteryEndTimestamp.toString()).to.equal(
        currentEndTimestamp.toString()
      );
    });

    it("mints a number of tickets to the winner equal to the prize pool", async () => {
      // state should be Open
      let state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");

      // lottery should not be empty
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      const isLotteryEmpty = await prizeLottery.isLotteryEmpty();
      expect(isLotteryEmpty).to.be.false;

      // enough time should have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      await time.increase(LOTTERY_LENGTH);
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);

      // check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.true;

      // check tickets before the drawing
      const playerInitialTicketBalance = await ticket.stakeOf(player1);
      expect(playerInitialTicketBalance.toString()).to.equal(DEPOSIT_AMOUNT);

      const RANDOM_NUMBER = "135432";
      await prizeLottery._draw(RANDOM_NUMBER);

      const balanceOfUnderlying =
        await prizeLottery.balanceOfUnderlyingCompound.call(CDAI_ADDRESS);

      // there is only 1 player so we are sure that the winner picked is that player
      const playerFinalTicketBalance = await ticket.stakeOf(player1);

      // check the ticket amount after the drawing
      expect(playerFinalTicketBalance.toString).to.equal(
        balanceOfUnderlying.toString
      );
    });

    it("emits a `LotteryWinnerAwarded` event", async () => {
      // state should be Open
      let state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");

      // lottery should not be empty
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      const isLotteryEmpty = await prizeLottery.isLotteryEmpty();
      expect(isLotteryEmpty).to.be.false;

      // enough time should have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      await time.increase(LOTTERY_LENGTH);
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);

      // check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.true;

      const playerInitialTicketBalance = await ticket.stakeOf(player1);

      const RANDOM_NUMBER = "135432";
      const drawReceipt = await prizeLottery._draw(RANDOM_NUMBER);

      const lotteryId = await prizeLottery.lotteryId();
      const playerFinalTicketBalance = new BN(await ticket.stakeOf(player1));
      const awardedPrize = playerFinalTicketBalance.sub(
        playerInitialTicketBalance
      );

      // check for the correct event
      expectEvent(drawReceipt, "LotteryWinnerAwarded", {
        lotteryId,
        player: player1,
        amount: awardedPrize.toString(),
      });
    });
  });

  describe("#checkUpkeep", () => {
    let prizeLottery;
    let ticket;
    let lotteryStartTimestamp;
    const player1 = accounts[1];

    mintDai(player1);

    beforeEach(async () => {
      ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
      prizeLottery = await PrizeLottery.new(
        ticket.address,
        DAI_ADDRESS,
        CDAI_ADDRESS
      );
      lotteryStartTimestamp = await prizeLottery.lotteryStart();
      await ticket.transferControllerRole(prizeLottery.address, {
        from: OWNER,
      });
    });

    it("returns False if the lottery is Closed and enough time has passed", async () => {
      // state should be Close
      await prizeLottery.changeState("2");
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("2");

      // enough time should have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      await time.increase(LOTTERY_LENGTH);
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);

      // Check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.false;
    });

    it("returns False if the lottery is Open and not enough time has passed", async () => {
      // state should be Open
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");

      // enough time should not have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.below(LOTTERY_LENGTH);

      // Check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.false;
    });

    it("returns False if the lottery is Closed and not enough time has passed", async () => {
      // state should be Close
      await prizeLottery.changeState("2");
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("2");

      // enough time should not have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.below(LOTTERY_LENGTH);

      // Check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.false;
    });

    it("returns False if the lottery is Closed, not enough time has passed and lottery is empty", async () => {
      // state should be Close
      await prizeLottery.changeState("2");
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("2");

      // enough time should not have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.below(LOTTERY_LENGTH);

      // lottery should be empty
      const isLotteryEmpty = await prizeLottery.isLotteryEmpty();
      expect(isLotteryEmpty).to.be.true;

      // Check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.false;
    });

    it("returns True only if the lottery is Open and enough time has passed and the lottery isn't empty", async () => {
      // state should be Open
      const state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");

      // enough time should have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      await time.increase(LOTTERY_LENGTH);
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);

      // lottery should not be empty
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      const isLotteryEmpty = await prizeLottery.isLotteryEmpty();
      expect(isLotteryEmpty).to.be.false;

      // Check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.true;
    });
  });

  describe("#performUpkeep", () => {
    let prizeLottery;
    let ticket;
    let lotteryStartTimestamp;
    const player1 = accounts[1];

    mintDai(player1);

    beforeEach(async () => {
      ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
      prizeLottery = await PrizeLottery.new(
        ticket.address,
        DAI_ADDRESS,
        CDAI_ADDRESS
      );
      lotteryStartTimestamp = await prizeLottery.lotteryStart();
      await ticket.transferControllerRole(prizeLottery.address, {
        from: OWNER,
      });
    });

    it("reverts if the upkeep is not needed", async () => {
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.false;

      await expectRevert(
        prizeLottery.performUpkeep("0x"),
        "PrizeLottery: UPKEEP_NOT_NEEDED"
      );
    });

    /*
    it("sets the state to AWARDING_WINNER and emits a `LotteryWinnerRequested` event", async () => {
      // state should be Open
      let state = await prizeLottery.state();
      expect(state.toString()).to.equal("0");

      // enough time should have passed
      const LOTTERY_LENGTH = 1000; // 1000 secs
      await time.increase(LOTTERY_LENGTH);
      const currentTimestamp = await time.latest();
      expect(
        parseInt(currentTimestamp.toString()) -
          parseInt(lotteryStartTimestamp.toString())
      ).to.be.above(LOTTERY_LENGTH);

      // lottery should not be empty
      const DEPOSIT_AMOUNT = web3.utils.toWei("1");
      await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
        from: player1,
      });
      await prizeLottery.deposit(DEPOSIT_AMOUNT, {
        from: player1,
      });
      const isLotteryEmpty = await prizeLottery.isLotteryEmpty();
      expect(isLotteryEmpty).to.be.false;

      // check upkeep
      const checkUpkeepResult = await prizeLottery.checkUpkeep("0x");
      const { upkeepNeeded } = checkUpkeepResult;
      expect(upkeepNeeded).to.be.true;

      const RANDOM_NUMBER = "135432";
      const drawReceipt = await prizeLottery._draw(RANDOM_NUMBER);

      // state should be AWARDING_WINNER
      state = await prizeLottery.state();
      expect(state.toString()).to.equal("1");

      // should emit a `LotteryWinnerRequested` event
      expectEvent(drawReceipt, "LotteryWinnerRequested");
    });
    */
  });

  describe("#prizePool", () => {
    let prizeLottery;
    let ticket;
    const player1 = accounts[1];

    // Mints 500 DAI to player1
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
      await time.increase(1000);

      // in those 1000 secs the amount deposited should
      // have earned a bit of interest
      const prizePool = await prizeLottery.prizePool.call();
      expect(parseInt(prizePool.toString())).to.be.at.least(
        parseInt(web3.utils.toWei("0"))
      );
    });
  });
});
