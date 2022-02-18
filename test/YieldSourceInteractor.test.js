const { assert } = require("chai");
const {
  expectRevert,
  time,
  expectEvent,
} = require("@openzeppelin/test-helpers");

const YieldSourceInteractor = artifacts.require("YieldSourceInteractor");

const IERC20_ABI = require("../build/IERC20.json");
const CTOKEN_ABI = require("../build/ICToken.json");

const DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
const CDAI_ADDRESS = "0x5d3a536E4D6DbD6114cc1Ead35777bAB948E3643";

const mintDai = require("../scripts/mint-dai");

contract("YieldSourceInteractor", (accounts) => {
  const controller = accounts[0];
  let yieldSourceInteractor;

  before(async () => {
    yieldSourceInteractor = await YieldSourceInteractor.new(controller);
  });

  describe("supplyToCompound", () => {
    it("reverts if the the caller is not the controller", async () => {
      await expectRevert(
        yieldSourceInteractor.supplyToCompound(
          DAI_ADDRESS,
          CDAI_ADDRESS,
          web3.utils.toWei("0"),
          {
            from: accounts[1],
          }
        ),
        "Controller: CALLER_IS_NOT_CONTROLLER"
      );
    });

    it("supplies tokens to Compound and mints cTokens", async () => {
      mintDai(yieldSourceInteractor.address);
      const txReceipt = await yieldSourceInteractor.supplyToCompound(
        DAI_ADDRESS,
        CDAI_ADDRESS,
        web3.utils.toWei("10"),
        {
          from: controller,
        }
      );

      expectEvent(txReceipt, "SuppliedToCompound", {
        token: DAI_ADDRESS,
        cToken: CDAI_ADDRESS,
        amount: web3.utils.toWei("10"),
      });
    });
  });

  describe("supplyRatePerBlockCompound", () => {
    it("return the supply rate per block for the DAI token", async () => {
      const ETH_MANTISSA = 1e18;
      const BLOCKS_PER_DAY = 6570; // 13.15 seconds per block
      const DAYS_PER_YEAR = 365;

      const supplyRatePerBlock =
        await yieldSourceInteractor.supplyRatePerBlockCompound.call(
          CDAI_ADDRESS
        );

      const apyCompound =
        (Math.pow(
          (supplyRatePerBlock / ETH_MANTISSA) * BLOCKS_PER_DAY + 1,
          DAYS_PER_YEAR
        ) -
          1) *
        100;

      console.log(`Supply APY for DAI (Compound) ${apyCompound} %`);

      expect(apyCompound).to.be.greaterThan(2);
    });
  });
});
