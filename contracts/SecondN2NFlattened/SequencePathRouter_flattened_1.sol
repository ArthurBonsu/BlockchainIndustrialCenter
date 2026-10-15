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

// File: SequencePathRouter.sol
pragma solidity ^0.8.20;


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
