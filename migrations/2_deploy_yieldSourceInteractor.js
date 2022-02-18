const YieldSourceInteractor = artifacts.require("YieldSourceInteractor");

module.exports = function (deployer, _, accounts) {
  const controller = accounts[0];

  deployer.deploy(YieldSourceInteractor, controller);
};
