// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IVehicleRegistry {
    function isVehicleRegistered(string memory _pseudonym) external view returns (bool);
    function getVehicle(string memory _pseudonym) external view returns (address owner, uint256 registrationTime, bool isRegistered);
    function getPseudonymByOwner(address _owner) external view returns (string memory);
}
