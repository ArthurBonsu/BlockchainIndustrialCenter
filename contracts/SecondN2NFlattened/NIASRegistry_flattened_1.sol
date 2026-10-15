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

// File: NIASRegistry.sol
pragma solidity ^0.8.0;


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
