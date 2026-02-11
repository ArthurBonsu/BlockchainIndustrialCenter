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
    function registerVehicle(string memory _pseudonym) external {
        require(!vehicles[_pseudonym].isRegistered, "Pseudonym already registered");
        require(bytes(ownerToPseudonym[msg.sender]).length == 0, "Address already has a vehicle");
        
        vehicles[_pseudonym] = Vehicle({
            pseudonym: _pseudonym,
            owner: msg.sender,
            registrationTime: block.timestamp,
            isRegistered: true
        });
        
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
    
    // Get pseudonym by owner address
    function getPseudonymByOwner(address _owner) external view returns (string memory) {
        return ownerToPseudonym[_owner];
    }
    
    // Remove vehicle (called by RevocationManager)
    function removeVehicle(string memory _pseudonym) external {
        require(vehicles[_pseudonym].isRegistered, "Vehicle not registered");
        
        address owner = vehicles[_pseudonym].owner;
        delete ownerToPseudonym[owner];
        delete vehicles[_pseudonym];
        
        emit VehicleRemoved(_pseudonym, block.timestamp);
    }
}