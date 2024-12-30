// requiring the contract
var Hospital = artifacts.require("./contracts/HealthcareSystem.sol");

// exporting as module 
 module.exports = function(deployer) {
  deployer.deploy(Hospital);
 };