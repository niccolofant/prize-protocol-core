const PrizeLottery = artifacts.require("CompoundPrizeLotteryTest");
const Ticket = artifacts.require("Ticket");

const IERC20 = require("../build/IERC20.json");
const ICToken = require("../build/ICToken.json");

const TokensAddress = require("../utils/erc20Tokens.json");

const mintDai = require("./mintDai");

module.exports = async (callback) => {
  const accounts = await web3.eth.getAccounts();
  const gasPrice = await web3.eth.getGasPrice();

  const TICKET_NAME = "Ticket";
  const TICKET_SYMBOL = "TKT";
  const OWNER = accounts[0];
  const TOKENS_ADDRESS = TokensAddress["mainnet"];

  const DAI_ADDRESS = TOKENS_ADDRESS.dai;
  const DAI = new web3.eth.Contract(IERC20.abi, DAI_ADDRESS);

  const CDAI_ADDRESS = TOKENS_ADDRESS.cDai;
  const CDAI = new web3.eth.Contract(ICToken.abi, CDAI_ADDRESS);

  const ticket = await Ticket.new(TICKET_NAME, TICKET_SYMBOL, OWNER);
  const prizeLottery = await PrizeLottery.new(
    ticket.address,
    DAI_ADDRESS,
    CDAI_ADDRESS
  );

  await ticket.transferControllerRole(prizeLottery.address, {
    from: OWNER,
  });

  mintDai(OWNER);

  console.log("====== MAINNET GAS USAGE ESTIMATION ======");

  // Estimate gas usage for Deposit function
  const DEPOSIT_AMOUNT = web3.utils.toWei("1");
  await DAI.methods.approve(prizeLottery.address, DEPOSIT_AMOUNT).send({
    from: OWNER,
  });
  const gasEstimateDeposit = await prizeLottery.deposit.estimateGas(
    web3.utils.toWei("1"),
    { from: OWNER }
  );
  console.log(
    `Gas usage for the deposit function: ${web3.utils.fromWei(
      (parseInt(gasEstimateDeposit) * parseInt(gasPrice)).toString()
    )} ETH`
  );

  // Estimate gas usage for Redeem function
  await prizeLottery.deposit(web3.utils.toWei("1"), { from: OWNER });
  const REDEEM_AMOUNT = await web3.utils.toWei("0.1");
  const gasEstimateRedeem = await prizeLottery.redeem.estimateGas(
    REDEEM_AMOUNT,
    {
      from: OWNER,
    }
  );
  console.log(
    `Gas usage for the redeem function: ${web3.utils.fromWei(
      (parseInt(gasEstimateRedeem) * parseInt(gasPrice)).toString()
    )} ETH`
  );
  callback();
};
