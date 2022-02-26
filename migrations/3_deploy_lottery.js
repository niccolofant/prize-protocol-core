const CompoundPrizeLottery = artifacts.require("CompoundPrizeLottery");
const Ticket = artifacts.require("Ticket");

const ERC20_ADDRESSES = require("../utils/erc20Tokens.json");
const CHAINLINK = require("../utils/chainlink.json");

const VRF_SUBSCRIPTION_ID = process.env.VRF_SUBSCRIPTION_ID;

module.exports = async function (deployer, network) {
  const ERC20_NETWORK_ADDRESSES = ERC20_ADDRESSES[network];
  const CHAINLINK_NETWORK = CHAINLINK[network];

  const NAME = "Prize Lottery USDT Compound";

  deployer.deploy(
    CompoundPrizeLottery,
    NAME,
    Ticket.address,
    ERC20_NETWORK_ADDRESSES.usdt,
    ERC20_NETWORK_ADDRESSES.cUsdt,
    VRF_SUBSCRIPTION_ID /* Remember to create a new VRF subscription and use the correct subscription ID */,
    CHAINLINK_NETWORK.vrfCoordinator,
    CHAINLINK_NETWORK.keyHash
  );
};
