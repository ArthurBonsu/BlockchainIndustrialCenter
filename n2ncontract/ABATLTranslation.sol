// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ABATLTranslation is Ownable, ReentrancyGuard {
    
    struct ABATLMapping {
        string sourceNID;
        string destNIAS;
        string attributes;
        uint256 latency;
        uint256 bandwidth;
        string securityLevel;
        string qosLevel;
        uint256 timestamp;
        bool isActive;
    }
    
    struct TranslationMetrics {
        uint256 totalTranslations;
        uint256 successfulTranslations;
        uint256 averageLatency;
        uint256 totalBandwidth;
    }
    
    mapping(bytes32 => ABATLMapping) public abatlMappings;
    mapping(string => string) public nidToNiasMapping;
    mapping(string => bool) public registeredNIDs;
    mapping(string => bool) public registeredNIAS;
    
    TranslationMetrics public metrics;
    
    uint256 public translationCounter;
    
    event TranslationCreated(
        bytes32 indexed mappingId,
        string sourceNID,
        string destNIAS,
        uint256 latency,
        string securityLevel
    );
    
    event TranslationUpdated(
        bytes32 indexed mappingId,
        uint256 newLatency,
        string newSecurityLevel
    );
    
      constructor() Ownable(msg.sender)  {}
    
    function createABATLMapping(
        string memory _sourceNID,
        string memory _destNIAS,
        string memory _attributes,
        uint256 _latency,
        uint256 _bandwidth,
        string memory _securityLevel,
        string memory _qosLevel
    ) external returns (bytes32) {
        require(bytes(_sourceNID).length > 0, "Invalid source NID");
        require(bytes(_destNIAS).length > 0, "Invalid destination NIAS");
        
        bytes32 mappingId = keccak256(abi.encodePacked(_sourceNID, _destNIAS, block.timestamp));
        
        abatlMappings[mappingId] = ABATLMapping({
            sourceNID: _sourceNID,
            destNIAS: _destNIAS,
            attributes: _attributes,
            latency: _latency,
            bandwidth: _bandwidth,
            securityLevel: _securityLevel,
            qosLevel: _qosLevel,
            timestamp: block.timestamp,
            isActive: true
        });
        
        nidToNiasMapping[_sourceNID] = _destNIAS;
        registeredNIDs[_sourceNID] = true;
        registeredNIAS[_destNIAS] = true;
        
        translationCounter++;
        
        // Update metrics
        metrics.totalTranslations++;
        metrics.successfulTranslations++;
        metrics.averageLatency = (metrics.averageLatency * (metrics.totalTranslations - 1) + _latency) / metrics.totalTranslations;
        metrics.totalBandwidth += _bandwidth;
        
        emit TranslationCreated(mappingId, _sourceNID, _destNIAS, _latency, _securityLevel);
        
        return mappingId;
    }
    
    function translateRoute(
        string memory _sourceNID,
        string memory _destNIAS
    ) external view returns (ABATLMapping memory) {
        bytes32 mappingId = keccak256(abi.encodePacked(_sourceNID, _destNIAS));
        return abatlMappings[mappingId];
    }
    
    function getTranslationMetrics() external view returns (
        uint256 totalTranslations,
        uint256 successfulTranslations,
        uint256 averageLatency,
        uint256 totalBandwidth,
        uint256 activeTranslations
    ) {
        return (
            metrics.totalTranslations,
            metrics.successfulTranslations,
            metrics.averageLatency,
            metrics.totalBandwidth,
            translationCounter
        );
    }
    
    function updateTranslation(
        bytes32 _mappingId,
        uint256 _newLatency,
        string memory _newSecurityLevel
    ) external onlyOwner {
        require(abatlMappings[_mappingId].isActive, "Translation not active");
        
        abatlMappings[_mappingId].latency = _newLatency;
        abatlMappings[_mappingId].securityLevel = _newSecurityLevel;
        abatlMappings[_mappingId].timestamp = block.timestamp;
        
        emit TranslationUpdated(_mappingId, _newLatency, _newSecurityLevel);
    }
    
    function getActiveMappingsCount() external view returns (uint256) {
        return translationCounter;
    }
    
    function isNIDRegistered(string memory _nid) external view returns (bool) {
        return registeredNIDs[_nid];
    }
    
    function isNIASRegistered(string memory _nias) external view returns (bool) {
        return registeredNIAS[_nias];
    }
}