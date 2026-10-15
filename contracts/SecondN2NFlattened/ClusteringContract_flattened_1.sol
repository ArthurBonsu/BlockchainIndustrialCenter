// SPDX-License-Identifier: MIT
// File: @openzeppelin/contracts/utils/Context.sol
// OpenZeppelin Contracts (last updated v5.0.1) (utils/Context.sol)

pragma solidity ^0.8.20;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}

// File: @openzeppelin/contracts/access/Ownable.sol
// OpenZeppelin Contracts (last updated v5.0.0) (access/Ownable.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * The initial owner is set to the address provided by the deployer. This can
 * later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    /**
     * @dev The caller account is not authorized to perform an operation.
     */
    error OwnableUnauthorizedAccount(address account);

    /**
     * @dev The owner is not a valid owner account. (eg. `address(0)`)
     */
    error OwnableInvalidOwner(address owner);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the address provided by the deployer as the initial owner.
     */
    constructor(address initialOwner) {
        if (initialOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(initialOwner);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        if (owner() != _msgSender()) {
            revert OwnableUnauthorizedAccount(_msgSender());
        }
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        if (newOwner == address(0)) {
            revert OwnableInvalidOwner(address(0));
        }
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

// File: @openzeppelin/contracts/utils/ReentrancyGuard.sol
// OpenZeppelin Contracts (last updated v5.1.0) (utils/ReentrancyGuard.sol)

pragma solidity ^0.8.20;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If EIP-1153 (transient storage) is available on the chain you're deploying at,
 * consider using {ReentrancyGuardTransient} instead.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    uint256 private _status;

    /**
     * @dev Unauthorized reentrant call.
     */
    error ReentrancyGuardReentrantCall();

    constructor() {
        _status = NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be NOT_ENTERED
        if (_status == ENTERED) {
            revert ReentrancyGuardReentrantCall();
        }

        // Any calls to nonReentrant after this point will fail
        _status = ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == ENTERED;
    }
}

// File: ClusteringContract.sol
pragma solidity ^0.8.20;


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
