// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ClusteringContract is Ownable, ReentrancyGuard {
    
    struct Cluster {
        string clusterId;
        string clusterType;
        string[] nodeIds;
        address manager;
        uint256 maxNodes;
        uint256 currentNodes;
        string region;
        bool isActive;
        uint256 creationTime;
        uint256 lastUpdate;
    }
    
    struct ClusterMetrics {
        uint256 totalClusters;
        uint256 activeClusters;
        uint256 totalNodes;
        uint256 averageClusterSize;
        mapping(string => uint256) clusterTypeCounts;
    }
    
    mapping(string => Cluster) public clusters;
    mapping(string => string) public nodeToCluster;
    mapping(address => string[]) public managerToClusters;
    mapping(string => bool) public supportedClusterTypes;
    
    string[] public allClusterIds;
    ClusterMetrics public clusteringMetrics;
    
    event ClusterCreated(
        string indexed clusterId,
        string clusterType,
        address indexed manager,
        uint256 maxNodes
    );
    
    event NodeAddedToCluster(
        string indexed clusterId,
        string indexed nodeId,
        uint256 newClusterSize
    );
    
    event NodeRemovedFromCluster(
        string indexed clusterId,
        string indexed nodeId,
        uint256 newClusterSize
    );
    
    event ClusterUpdated(
        string indexed clusterId,
        uint256 timestamp
    );
    
    // Fixed constructor - now passes msg.sender as initialOwner to Ownable
    constructor() Ownable(msg.sender) {
        // Initialize supported cluster types
        supportedClusterTypes["NAP_CLUSTER"] = true;
        supportedClusterTypes["BGPF_CLUSTER"] = true;
        supportedClusterTypes["MIXED_CLUSTER"] = true;
        supportedClusterTypes["FAILOVER_CLUSTER"] = true;
        supportedClusterTypes["LOAD_BALANCE_CLUSTER"] = true;
    }
    
    function createCluster(
        string memory _clusterId,
        string memory _clusterType,
        uint256 _maxNodes,
        string memory _region
    ) external returns (bool) {
        require(bytes(_clusterId).length > 0, "Invalid cluster ID");
        require(clusters[_clusterId].manager == address(0), "Cluster already exists");

        require(supportedClusterTypes[_clusterType], "Unsupported cluster type");
       require(_maxNodes > 0 && _maxNodes <= 1000, "Invalid max nodes");
       
       string[] memory emptyNodes;
       
       clusters[_clusterId] = Cluster({
           clusterId: _clusterId,
           clusterType: _clusterType,
           nodeIds: emptyNodes,
           manager: msg.sender,
           maxNodes: _maxNodes,
           currentNodes: 0,
           region: _region,
           isActive: true,
           creationTime: block.timestamp,
           lastUpdate: block.timestamp
       });
       
       allClusterIds.push(_clusterId);
       managerToClusters[msg.sender].push(_clusterId);
       
       // Update metrics
       clusteringMetrics.totalClusters++;
       clusteringMetrics.activeClusters++;
       clusteringMetrics.clusterTypeCounts[_clusterType]++;
       
       emit ClusterCreated(_clusterId, _clusterType, msg.sender, _maxNodes);
       
       return true;
   }
   
   function addNodeToCluster(
       string memory _clusterId,
       string memory _nodeId
   ) external returns (bool) {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       require(clusters[_clusterId].manager == msg.sender || msg.sender == owner(), "Not authorized");
       require(clusters[_clusterId].isActive, "Cluster not active");
       require(clusters[_clusterId].currentNodes < clusters[_clusterId].maxNodes, "Cluster at capacity");
       require(bytes(nodeToCluster[_nodeId]).length == 0, "Node already in a cluster");
       
       clusters[_clusterId].nodeIds.push(_nodeId);
       clusters[_clusterId].currentNodes++;
       clusters[_clusterId].lastUpdate = block.timestamp;
       
       nodeToCluster[_nodeId] = _clusterId;
       
       // Update metrics
       clusteringMetrics.totalNodes++;
       clusteringMetrics.averageClusterSize = clusteringMetrics.totalNodes / clusteringMetrics.activeClusters;
       
       emit NodeAddedToCluster(_clusterId, _nodeId, clusters[_clusterId].currentNodes);
       
       return true;
   }
   
   function removeNodeFromCluster(
       string memory _clusterId,
       string memory _nodeId
   ) external returns (bool) {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       require(clusters[_clusterId].manager == msg.sender || msg.sender == owner(), "Not authorized");
       require(keccak256(abi.encodePacked(nodeToCluster[_nodeId])) == keccak256(abi.encodePacked(_clusterId)), "Node not in this cluster");
       
       // Find and remove node from array
       string[] storage nodeIds = clusters[_clusterId].nodeIds;
       for (uint i = 0; i < nodeIds.length; i++) {
           if (keccak256(abi.encodePacked(nodeIds[i])) == keccak256(abi.encodePacked(_nodeId))) {
               nodeIds[i] = nodeIds[nodeIds.length - 1];
               nodeIds.pop();
               break;
           }
       }
       
       clusters[_clusterId].currentNodes--;
       clusters[_clusterId].lastUpdate = block.timestamp;
       
       delete nodeToCluster[_nodeId];
       
       // Update metrics
       clusteringMetrics.totalNodes--;
       if (clusteringMetrics.activeClusters > 0) {
           clusteringMetrics.averageClusterSize = clusteringMetrics.totalNodes / clusteringMetrics.activeClusters;
       }
       
       emit NodeRemovedFromCluster(_clusterId, _nodeId, clusters[_clusterId].currentNodes);
       
       return true;
   }
   
   function getClusterDetails(string memory _clusterId) external view returns (
       string memory clusterId,
       string memory clusterType,
       string[] memory nodeIds,
       address manager,
       uint256 maxNodes,
       uint256 currentNodes,
       string memory region,
       bool isActive,
       uint256 creationTime
   ) {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       
       Cluster memory cluster = clusters[_clusterId];
       return (
           cluster.clusterId,
           cluster.clusterType,
           cluster.nodeIds,
           cluster.manager,
           cluster.maxNodes,
           cluster.currentNodes,
           cluster.region,
           cluster.isActive,
           cluster.creationTime
       );
   }
   
   function getClusteringMetrics() external view returns (
       uint256 totalClusters,
       uint256 activeClusters,
       uint256 totalNodes,
       uint256 averageClusterSize
   ) {
       return (
           clusteringMetrics.totalClusters,
           clusteringMetrics.activeClusters,
           clusteringMetrics.totalNodes,
           clusteringMetrics.averageClusterSize
       );
   }
   
   function getClusterTypeCount(string memory _clusterType) external view returns (uint256) {
       return clusteringMetrics.clusterTypeCounts[_clusterType];
   }
   
   function getNodeCluster(string memory _nodeId) external view returns (string memory) {
       return nodeToCluster[_nodeId];
   }
   
   function getAllClusters() external view returns (string[] memory) {
       return allClusterIds;
   }
   
   function getClustersByManager(address _manager) external view returns (string[] memory) {
       return managerToClusters[_manager];
   }
   
   function updateCluster(
       string memory _clusterId,
       uint256 _newMaxNodes,
       string memory _newRegion
   ) external {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       require(clusters[_clusterId].manager == msg.sender || msg.sender == owner(), "Not authorized");
       require(_newMaxNodes >= clusters[_clusterId].currentNodes, "Cannot reduce below current nodes");
       
       clusters[_clusterId].maxNodes = _newMaxNodes;
       clusters[_clusterId].region = _newRegion;
       clusters[_clusterId].lastUpdate = block.timestamp;
       
       emit ClusterUpdated(_clusterId, block.timestamp);
   }
   
   function deactivateCluster(string memory _clusterId) external {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       require(clusters[_clusterId].manager == msg.sender || msg.sender == owner(), "Not authorized");
       
       // Remove all nodes from cluster
       string[] memory nodeIds = clusters[_clusterId].nodeIds;
       for (uint i = 0; i < nodeIds.length; i++) {
           delete nodeToCluster[nodeIds[i]];
       }
       
       clusters[_clusterId].isActive = false;
       clusters[_clusterId].currentNodes = 0;
       clusters[_clusterId].lastUpdate = block.timestamp;
       delete clusters[_clusterId].nodeIds;
       
       clusteringMetrics.activeClusters--;
   }
   
   function isClusterActive(string memory _clusterId) external view returns (bool) {
       return clusters[_clusterId].manager != address(0) && clusters[_clusterId].isActive;
   }
   
   function addClusterType(string memory _clusterType) external onlyOwner {
       supportedClusterTypes[_clusterType] = true;
   }
   
   function removeClusterType(string memory _clusterType) external onlyOwner {
       supportedClusterTypes[_clusterType] = false;
   }
   
   function getClusterNodes(string memory _clusterId) external view returns (string[] memory) {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       return clusters[_clusterId].nodeIds;
   }
   
   function isNodeInCluster(string memory _nodeId, string memory _clusterId) external view returns (bool) {
       return keccak256(abi.encodePacked(nodeToCluster[_nodeId])) == keccak256(abi.encodePacked(_clusterId));
   }
   
   function getClusterUtilization(string memory _clusterId) external view returns (uint256) {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       
       if (clusters[_clusterId].maxNodes == 0) return 0;
       
       return (clusters[_clusterId].currentNodes * 100) / clusters[_clusterId].maxNodes;
   }
   
   function rebalanceCluster(string memory _clusterId) external {
       require(clusters[_clusterId].manager != address(0), "Cluster not found");
       require(clusters[_clusterId].manager == msg.sender || msg.sender == owner(), "Not authorized");
       
       // Simple rebalancing - just update timestamp for now
       // In production, this would implement actual load balancing logic
       clusters[_clusterId].lastUpdate = block.timestamp;
       
       emit ClusterUpdated(_clusterId, block.timestamp);
   }
}