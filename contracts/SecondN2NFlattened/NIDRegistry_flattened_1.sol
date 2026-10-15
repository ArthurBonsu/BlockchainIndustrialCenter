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

// File: NIDRegistry.sol
pragma solidity ^0.8.0;


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
