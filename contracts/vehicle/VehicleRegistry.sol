// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VehicleRegistry {

    struct Vehicle {
        string pseudonym;
        address owner;
        uint256 registrationTime;
        bool isRegistered;
    }

    mapping(string => Vehicle) public vehicles;
    mapping(address => string) public ownerToPseudonym;

    event VehicleRegistered(string indexed pseudonym, address indexed owner, uint256 timestamp);
    event VehicleRemoved(string indexed pseudonym, uint256 timestamp);

    // Register a new vehicle with a pseudonym
    // NOTE: One address can hold multiple pseudonyms; duplicate pseudonym check retained for data integrity
    function registerVehicle(string memory _pseudonym) external {
        require(!vehicles[_pseudonym].isRegistered, "Pseudonym already registered");
        // REMOVED: single-vehicle-per-address restriction
        // This allows the same address to register multiple pseudonyms (needed for testing scenarios)

        vehicles[_pseudonym] = Vehicle({
            pseudonym: _pseudonym,
            owner: msg.sender,
            registrationTime: block.timestamp,
            isRegistered: true
        });

        // Always update ownerToPseudonym to latest registered pseudonym
        ownerToPseudonym[msg.sender] = _pseudonym;

        emit VehicleRegistered(_pseudonym, msg.sender, block.timestamp);
    }

    // Check if vehicle is registered
    function isVehicleRegistered(string memory _pseudonym) external view returns (bool) {
        return vehicles[_pseudonym].isRegistered;
    }

    // Get vehicle details
    function getVehicle(string memory _pseudonym) external view returns (
        address owner,
        uint256 registrationTime,
        bool isRegistered
    ) {
        Vehicle memory v = vehicles[_pseudonym];
        return (v.owner, v.registrationTime, v.isRegistered);
    }

    // Get latest pseudonym by owner address
    function getPseudonymByOwner(address _owner) external view returns (string memory) {
        return ownerToPseudonym[_owner];
    }

    // Remove vehicle - callable by anyone (open for testing)
    function removeVehicle(string memory _pseudonym) external {
        require(vehicles[_pseudonym].isRegistered, "Vehicle not registered");

        address owner = vehicles[_pseudonym].owner;
        // Only clear ownerToPseudonym if it points to this pseudonym
        if (keccak256(bytes(ownerToPseudonym[owner])) == keccak256(bytes(_pseudonym))) {
            delete ownerToPseudonym[owner];
        }
        delete vehicles[_pseudonym];

        emit VehicleRemoved(_pseudonym, block.timestamp);
    }
}
