const PrizeToken = artifacts.require("PrizeToken");

module.exports = function (deployer) {
  deployer.deploy(PrizeToken);
};
