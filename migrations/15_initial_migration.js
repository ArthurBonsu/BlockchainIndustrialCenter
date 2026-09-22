const VehicleRegistry = artifacts.require("VehicleRegistry");
const RevocationManager = artifacts.require("RevocationManager");

module.exports = async function (deployer) {
  // VehicleRegistry takes no constructor arguments
  await deployer.deploy(VehicleRegistry);
  const vehicleRegistry = await VehicleRegistry.deployed();

  // RevocationManager's constructor needs VehicleRegistry's deployed address
  await deployer.deploy(RevocationManager, vehicleRegistry.address);
};