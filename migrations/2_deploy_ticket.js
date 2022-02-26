const Ticket = artifacts.require("Ticket");

module.exports = function (deployer, _, accounts) {
  const OWNER = accounts[0];
  const NAME = "Prize Ticket USDT Compound";
  const SYMBOL = "ptUSDTc";
  deployer.deploy(Ticket, NAME, SYMBOL, OWNER);
};
