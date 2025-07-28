// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract NIASRegistry is Ownable, ReentrancyGuard {
    
    struct NIASNode {
        string niasId;
        string nodeType;
        string attributes;
        address owner;
        uint256 securityLevel;
        uint256 bandwidth;
        string region;
        bool isActive;
        uint256 registrationTime;
        uint256 lastUpdate;
    }
    
    struct NIASMetrics {
        uint256 totalRegistered;
        uint256 activeNodes;
        uint256 totalBandwidth;
        uint256 averageSecurityLevel;
    }
    
    mapping(string => NIASNode) public niasNodes;
    mapping(address => string[]) public ownerToNIAS;
    mapping(string => bool) public niasExists;
    
    string[] public allNIASIds;
    NIASMetrics public registryMetrics;
    
    event NIASRegistered(
        string indexed niasId,
        address indexed owner,
        string nodeType,
        uint256 securityLevel
    );
    
    event NIASUpdated(
        string indexed niasId,
        uint256 newSecurityLevel,
        uint256 newBandwidth
    );
    
    event NIASDeactivated(string indexed niasId);
    
   constructor() Ownable(msg.sender) {}
    
    function registerNIAS(
        string memory _niasId,
        string memory _nodeType,
        string memory _attributes,
        uint256 _securityLevel,
        uint256 _bandwidth,
        string memory _region
    ) external returns (bool) {
        require(bytes(_niasId).length > 0, "Invalid NIAS ID");
        require(!niasExists[_niasId], "NIAS already registered");
        require(_securityLevel > 0 && _securityLevel <= 100, "Invalid security level");
        
        niasNodes[_niasId] = NIASNode({
            niasId: _niasId,
            nodeType: _nodeType,
            attributes: _attributes,
            owner: msg.sender,
            securityLevel: _securityLevel,
            bandwidth: _bandwidth,
            region: _region,
            isActive: true,
            registrationTime: block.timestamp,
            lastUpdate: block.timestamp
        });
        
        niasExists[_niasId] = true;
        allNIASIds.push(_niasId);
        ownerToNIAS[msg.sender].push(_niasId);
        
        // Update metrics
        registryMetrics.totalRegistered++;
        registryMetrics.activeNodes++;
        registryMetrics.totalBandwidth += _bandwidth;
        registryMetrics.averageSecurityLevel = 
            (registryMetrics.averageSecurityLevel * (registryMetrics.totalRegistered - 1) + _securityLevel) / 
            registryMetrics.totalRegistered;
        
        emit NIASRegistered(_niasId, msg.sender, _nodeType, _securityLevel);
        
        return true;
    }
    
    function updateNIAS(
        string memory _niasId,
        uint256 _newSecurityLevel,
        uint256 _newBandwidth,
        string memory _newAttributes
    ) external {
        require(niasExists[_niasId], "NIAS not found");
        require(niasNodes[_niasId].owner == msg.sender || msg.sender == owner(), "Not authorized");
        require(_newSecurityLevel > 0 && _newSecurityLevel <= 100, "Invalid security level");
        
        NIASNode storage node = niasNodes[_niasId];
        
        // Update metrics for bandwidth change
        registryMetrics.totalBandwidth = registryMetrics.totalBandwidth - node.bandwidth + _newBandwidth;
        
        node.securityLevel = _newSecurityLevel;
        node.bandwidth = _newBandwidth;
        node.attributes = _newAttributes;
        node.lastUpdate = block.timestamp;
        
        emit NIASUpdated(_niasId, _newSecurityLevel, _newBandwidth);
    }
    
    function getNIASDetails(string memory _niasId) external view returns (
        string memory niasId,
        string memory nodeType,
        string memory attributes,
        address owner,
        uint256 securityLevel,
        uint256 bandwidth,
        string memory region,
        bool isActive,
        uint256 registrationTime
    ) {
        require(niasExists[_niasId], "NIAS not found");
        
        NIASNode memory node = niasNodes[_niasId];
        return (
            node.niasId,
            node.nodeType,
            node.attributes,
            node.owner,
            node.securityLevel,
            node.bandwidth,
            node.region,
            node.isActive,
            node.registrationTime
        );
    }
    
    function getRegistryMetrics() external view returns (
        uint256 totalRegistered,
        uint256 activeNodes,
        uint256 totalBandwidth,
        uint256 averageSecurityLevel
    ) {
        return (
            registryMetrics.totalRegistered,
            registryMetrics.activeNodes,
            registryMetrics.totalBandwidth,
            registryMetrics.averageSecurityLevel
        );
    }
    
    function getAllNIAS() external view returns (string[] memory) {
        return allNIASIds;
    }
    
    function getNIASByOwner(address _owner) external view returns (string[] memory) {
        return ownerToNIAS[_owner];
    }
    
    function deactivateNIAS(string memory _niasId) external {
        require(niasExists[_niasId], "NIAS not found");
        require(niasNodes[_niasId].owner == msg.sender || msg.sender == owner(), "Not authorized");
        
        niasNodes[_niasId].isActive = false;
        registryMetrics.activeNodes--;
        
        emit NIASDeactivated(_niasId);
    }
    
    function isNIASActive(string memory _niasId) external view returns (bool) {
        return niasExists[_niasId] && niasNodes[_niasId].isActive;
    }
}