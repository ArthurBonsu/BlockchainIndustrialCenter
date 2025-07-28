// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract SequencePathRouter is Ownable, ReentrancyGuard {
    
    struct PathSequence {
        string[] nodeSequence;
        uint256 totalLatency;
        uint256 minBandwidth;
        uint256 securityScore;
        string pathType;
        bool isActive;
        uint256 creationTime;
        uint256 lastUsed;
        address creator;
    }
    
    struct RouteMetrics {
        uint256 totalRoutes;
        uint256 activeRoutes;
        uint256 successfulRoutings;
        uint256 failedRoutings;
        uint256 averageLatency;
        uint256 totalPathsComputed;
    }
    
    mapping(bytes32 => PathSequence) public pathSequences;
    mapping(string => bytes32[]) public nodeToPathIds;
    mapping(string => bool) public supportedPathTypes;
    
    bytes32[] public allPathIds;
    RouteMetrics public routingMetrics;
    
    event PathSequenceCreated(
        bytes32 indexed pathId,
        string[] nodeSequence,
        uint256 totalLatency,
        string pathType
    );
    
    event PathSequenceUsed(
        bytes32 indexed pathId,
        address indexed user,
        uint256 timestamp
    );
    
    event RouteComputed(
        string indexed sourceNode,
        string indexed destNode,
        bytes32 pathId,
        uint256 latency
    );
    
    event PathValidated(
        bytes32 indexed pathId,
        bool isValid,
        uint256 validationTime
    );
    
    constructor() Ownable(msg.sender) {
        // Initialize supported path types
        supportedPathTypes["DIRECT"] = true;
        supportedPathTypes["MULTI_HOP"] = true;
        supportedPathTypes["FAILOVER"] = true;
        supportedPathTypes["LOAD_BALANCED"] = true;
        supportedPathTypes["PRIORITY"] = true;
    }
    
    function createPathSequence(
        string[] memory _nodeSequence,
        uint256 _totalLatency,
        uint256 _minBandwidth,
        uint256 _securityScore,
        string memory _pathType
    ) external returns (bytes32) {
        require(_nodeSequence.length >= 2, "Path must have at least 2 nodes");
        require(supportedPathTypes[_pathType], "Unsupported path type");
        require(_securityScore <= 100, "Invalid security score");
        
        // FIXED: Use abi.encode instead of abi.encodePacked for arrays
        bytes32 pathId = keccak256(abi.encode(
            _nodeSequence,
            _totalLatency,
            block.timestamp,
            msg.sender
        ));
        
        pathSequences[pathId] = PathSequence({
            nodeSequence: _nodeSequence,
            totalLatency: _totalLatency,
            minBandwidth: _minBandwidth,
            securityScore: _securityScore,
            pathType: _pathType,
            isActive: true,
            creationTime: block.timestamp,
            lastUsed: 0,
            creator: msg.sender
        });
        
        allPathIds.push(pathId);
        
        // Add to node mappings
        for (uint i = 0; i < _nodeSequence.length; i++) {
            nodeToPathIds[_nodeSequence[i]].push(pathId);
        }
        
        // Update metrics
        routingMetrics.totalRoutes++;
        routingMetrics.activeRoutes++;
        routingMetrics.totalPathsComputed++;
        
        // Fixed division by zero check
        if (routingMetrics.totalRoutes > 0) {
            routingMetrics.averageLatency = 
                (routingMetrics.averageLatency * (routingMetrics.totalRoutes - 1) + _totalLatency) / 
                routingMetrics.totalRoutes;
        }
        
        emit PathSequenceCreated(pathId, _nodeSequence, _totalLatency, _pathType);
        
        return pathId;
    }
    
    function computeRoute(
        string memory _sourceNode,
        string memory _destNode,
        string memory _pathType
    ) external returns (bytes32) {
        require(bytes(_sourceNode).length > 0, "Invalid source node");
        require(bytes(_destNode).length > 0, "Invalid destination node");
        require(supportedPathTypes[_pathType], "Unsupported path type");
        
        // Create a simple 2-hop path for demonstration
        string[] memory sequence = new string[](2);
        sequence[0] = _sourceNode;
        sequence[1] = _destNode;
        
        // Calculate simulated metrics
        uint256 latency = 10 + (uint256(keccak256(abi.encodePacked(_sourceNode, _destNode))) % 50);
        uint256 bandwidth = 100 + (uint256(keccak256(abi.encodePacked(_destNode, _sourceNode))) % 900);
        uint256 security = 70 + (uint256(keccak256(abi.encodePacked(block.timestamp))) % 30);
        
        bytes32 pathId = this.createPathSequence(
            sequence,
            latency,
            bandwidth,
            security,
            _pathType
        );
        
        routingMetrics.successfulRoutings++;
        
        emit RouteComputed(_sourceNode, _destNode, pathId, latency);
        
        return pathId;
    }
    
    function usePathSequence(bytes32 _pathId) external {
        require(pathSequences[_pathId].isActive, "Path not active");
        
        pathSequences[_pathId].lastUsed = block.timestamp;
        
        emit PathSequenceUsed(_pathId, msg.sender, block.timestamp);
    }
    
    function validatePath(bytes32 _pathId) external returns (bool) {
        require(pathSequences[_pathId].creator != address(0), "Path not found");
        
        PathSequence storage path = pathSequences[_pathId];
        
        // Simple validation logic
        bool isValid = path.isActive && 
                      path.nodeSequence.length >= 2 && 
                      path.totalLatency > 0 && 
                      path.securityScore > 0;
        
        emit PathValidated(_pathId, isValid, block.timestamp);
        
        return isValid;
    }
    
    function getPathSequence(bytes32 _pathId) external view returns (
        string[] memory nodeSequence,
        uint256 totalLatency,
        uint256 minBandwidth,
        uint256 securityScore,
        string memory pathType,
        bool isActive,
        uint256 creationTime,
        uint256 lastUsed
    ) {
        PathSequence memory path = pathSequences[_pathId];
        return (
            path.nodeSequence,
            path.totalLatency,
            path.minBandwidth,
            path.securityScore,
            path.pathType,
            path.isActive,
            path.creationTime,
            path.lastUsed
        );
    }
    
    function getRoutingMetrics() external view returns (
        uint256 totalRoutes,
        uint256 activeRoutes,
        uint256 successfulRoutings,
        uint256 failedRoutings,
        uint256 averageLatency,
        uint256 totalPathsComputed
    ) {
        return (
            routingMetrics.totalRoutes,
            routingMetrics.activeRoutes,
            routingMetrics.successfulRoutings,
            routingMetrics.failedRoutings,
            routingMetrics.averageLatency,
            routingMetrics.totalPathsComputed
        );
    }
    
    function getPathsByNode(string memory _nodeId) external view returns (bytes32[] memory) {
        return nodeToPathIds[_nodeId];
    }
    
    function getAllPaths() external view returns (bytes32[] memory) {
        return allPathIds;
    }
    
    function deactivatePath(bytes32 _pathId) external {
        require(pathSequences[_pathId].creator == msg.sender || msg.sender == owner(), "Not authorized");
        require(pathSequences[_pathId].isActive, "Path already inactive");
        
        pathSequences[_pathId].isActive = false;
        routingMetrics.activeRoutes--;
    }
    
    function addPathType(string memory _pathType) external onlyOwner {
        supportedPathTypes[_pathType] = true;
    }
    
    function removePathType(string memory _pathType) external onlyOwner {
        supportedPathTypes[_pathType] = false;
    }
    
   
}