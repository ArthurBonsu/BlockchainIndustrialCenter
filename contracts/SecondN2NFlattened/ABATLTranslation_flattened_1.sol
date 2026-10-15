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

// File: ABATLTranslation.sol
pragma solidity ^0.8.0;


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
    
      constructor() Ownable(msg.sender) {}
    
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
