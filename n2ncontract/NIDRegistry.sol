// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NIDRegistry is Ownable, ReentrancyGuard {
    
    struct NIDNode {
        string nidId;
        string primaryAttributes;
        string secondaryAttributes;
        address owner;
        string deviceType;
        string region;
        string organizationId;
        uint256 port;
        bool isActive;
        uint256 registrationTime;
        uint256 lastUpdate;
    }
    
    struct NIDMetrics {
        uint256 totalRegistered;
        uint256 activeNodes;
        uint256 totalDevices;
        mapping(string => uint256) deviceTypeCounts;
        mapping(string => uint256) regionCounts;
    }
    
    mapping(string => NIDNode) public nidNodes;
    mapping(address => string[]) public ownerToNIDs;
    mapping(string => bool) public nidExists;
    mapping(string => string[]) public organizationNIDs;
    
    string[] public allNIDIds;
    string[] public supportedDeviceTypes;
    string[] public supportedRegions;
    
    NIDMetrics public registryMetrics;
    
    event NIDRegistered(
        string indexed nidId,
        address indexed owner,
        string deviceType,
        string organizationId
    );
    
    event NIDUpdated(
        string indexed nidId,
        string newPrimaryAttributes,
        string newSecondaryAttributes
    );
    
    event NIDDeactivated(string indexed nidId);
    
     constructor() Ownable(msg.sender) {
        // Initialize supported device types
        supportedDeviceTypes.push("SERVER");
        supportedDeviceTypes.push("CLIENT");
        supportedDeviceTypes.push("ROUTER");
        supportedDeviceTypes.push("SWITCH");
        supportedDeviceTypes.push("GATEWAY");
        
        // Initialize supported regions
        supportedRegions.push("US-EAST");
        supportedRegions.push("US-WEST");
        supportedRegions.push("EU-CENTRAL");
        supportedRegions.push("ASIA-PACIFIC");
        supportedRegions.push("GLOBAL");
    }
    
    function registerNID(
        string memory _nidId,
        string memory _primaryAttributes,
        string memory _secondaryAttributes,
        string memory _deviceType,
        string memory _region,
        string memory _organizationId,
        uint256 _port
    ) external returns (bool) {
        require(bytes(_nidId).length > 0, "Invalid NID ID");
        require(!nidExists[_nidId], "NID already registered");
        require(_port > 0 && _port <= 65535, "Invalid port number");
        require(isValidDeviceType(_deviceType), "Unsupported device type");
        require(isValidRegion(_region), "Unsupported region");
        
        nidNodes[_nidId] = NIDNode({
            nidId: _nidId,
            primaryAttributes: _primaryAttributes,
            secondaryAttributes: _secondaryAttributes,
            owner: msg.sender,
            deviceType: _deviceType,
            region: _region,
            organizationId: _organizationId,
            port: _port,
            isActive: true,
            registrationTime: block.timestamp,
            lastUpdate: block.timestamp
        });
        
        nidExists[_nidId] = true;
        allNIDIds.push(_nidId);
        ownerToNIDs[msg.sender].push(_nidId);
        organizationNIDs[_organizationId].push(_nidId);
        
        // Update metrics
        registryMetrics.totalRegistered++;
        registryMetrics.activeNodes++;
        registryMetrics.totalDevices++;
        registryMetrics.deviceTypeCounts[_deviceType]++;
        registryMetrics.regionCounts[_region]++;
        
        emit NIDRegistered(_nidId, msg.sender, _deviceType, _organizationId);
        
        return true;
    }
    
    function updateNID(
        string memory _nidId,
        string memory _newPrimaryAttributes,
        string memory _newSecondaryAttributes
    ) external {
        require(nidExists[_nidId], "NID not found");
        require(nidNodes[_nidId].owner == msg.sender || msg.sender == owner(), "Not authorized");
        
        NIDNode storage node = nidNodes[_nidId];
        node.primaryAttributes = _newPrimaryAttributes;
        node.secondaryAttributes = _newSecondaryAttributes;
        node.lastUpdate = block.timestamp;
        
        emit NIDUpdated(_nidId, _newPrimaryAttributes, _newSecondaryAttributes);
    }
    
    function getNIDDetails(string memory _nidId) external view returns (
        string memory nidId,
        string memory primaryAttributes,
        string memory secondaryAttributes,
        address owner,
        string memory deviceType,
        string memory region,
        string memory organizationId,
        uint256 port,
        bool isActive,
        uint256 registrationTime
    ) {
        require(nidExists[_nidId], "NID not found");
        
        NIDNode memory node = nidNodes[_nidId];
        return (
            node.nidId,
            node.primaryAttributes,
            node.secondaryAttributes,
            node.owner,
            node.deviceType,
            node.region,
            node.organizationId,
            node.port,
            node.isActive,
            node.registrationTime
        );
    }
    
    function getRegistryMetrics() external view returns (
        uint256 totalRegistered,
        uint256 activeNodes,
        uint256 totalDevices
    ) {
        return (
            registryMetrics.totalRegistered,
            registryMetrics.activeNodes,
            registryMetrics.totalDevices
        );
    }
    
    function getDeviceTypeCount(string memory _deviceType) external view returns (uint256) {
        return registryMetrics.deviceTypeCounts[_deviceType];
    }
    
    function getRegionCount(string memory _region) external view returns (uint256) {
        return registryMetrics.regionCounts[_region];
    }
    
    function getAllNIDs() external view returns (string[] memory) {
        return allNIDIds;
    }
    
    function getNIDsByOwner(address _owner) external view returns (string[] memory) {
        return ownerToNIDs[_owner];
    }
    
    function getNIDsByOrganization(string memory _organizationId) external view returns (string[] memory) {
        return organizationNIDs[_organizationId];
    }
    
    function deactivateNID(string memory _nidId) external {
        require(nidExists[_nidId], "NID not found");
        require(nidNodes[_nidId].owner == msg.sender || msg.sender == owner(), "Not authorized");
        
        nidNodes[_nidId].isActive = false;
        registryMetrics.activeNodes--;
        
        emit NIDDeactivated(_nidId);
    }
    
    function isNIDActive(string memory _nidId) external view returns (bool) {
        return nidExists[_nidId] && nidNodes[_nidId].isActive;
    }
    
    function isValidDeviceType(string memory _deviceType) internal view returns (bool) {
        for (uint i = 0; i < supportedDeviceTypes.length; i++) {
            if (keccak256(abi.encodePacked(supportedDeviceTypes[i])) == keccak256(abi.encodePacked(_deviceType))) {
                return true;
            }
        }
        return false;
    }
    
    function isValidRegion(string memory _region) internal view returns (bool) {
        for (uint i = 0; i < supportedRegions.length; i++) {
            if (keccak256(abi.encodePacked(supportedRegions[i])) == keccak256(abi.encodePacked(_region))) {
                return true;
            }
        }
        return false;
    }
    
    function addDeviceType(string memory _deviceType) external onlyOwner {
        supportedDeviceTypes.push(_deviceType);
    }
    
    function addRegion(string memory _region) external onlyOwner {
        supportedRegions.push(_region);
    }
}