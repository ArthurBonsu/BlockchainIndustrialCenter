// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title IStreamBasedConsensus
 * @dev Interface for inter-contract communication
 */
interface IStreamBasedConsensus {
    function isValidator(address _validator) external view returns (bool);
    function getValidatorReputation(address _validator) external view returns (uint256);
    function updateTransactionState(bytes32 _txId, uint8 _state) external;
}

/**
 * @title StreamTransactionManager
 * @dev Handles transaction submission and lifecycle management
 */
contract StreamTransactionManager is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    enum TransactionState { RECEIVED, VALIDATED, ROUTING, CONSENSUS, COMMITTED, FINALIZED, REJECTED }
    enum RiskLevel { MINIMAL, STANDARD, ENHANCED }
    enum ComplexityClass { SIMPLE, MEDIUM, COMPLEX }

    struct StreamTransaction {
        bytes32 txId;
        address sender;
        address receiver;
        uint256 value;
        TransactionState state;
        uint256 arrivalTime;
        uint256 riskScore;
        RiskLevel riskLevel;
        ComplexityClass complexity;
        uint256 confidenceScore;
        uint256 validationCount;
        uint256 finalityTime;
    }

    mapping(bytes32 => StreamTransaction) public transactions;
    bytes32[] public transactionQueue;
    uint256 public totalTransactions;

    address public consensusCore;
    address public validatorManager;

    event TransactionReceived(bytes32 indexed txId, address sender, address receiver, uint256 value);
    event TransactionStateChanged(bytes32 indexed txId, TransactionState newState, uint256 confidence);

    constructor() Ownable(msg.sender) {}

    modifier onlyConsensusCore() {
        require(msg.sender == consensusCore, "Only consensus core");
        _;
    }

    function setConsensusCore(address _consensusCore) external onlyOwner {
        consensusCore = _consensusCore;
    }

    function setValidatorManager(address _validatorManager) external onlyOwner {
        validatorManager = _validatorManager;
    }

    function submitTransaction(address _receiver, uint256 _complexity) external payable nonReentrant {
        require(_receiver != address(0), "Invalid receiver");
        require(msg.value > 0, "Transaction value required");
        
        bytes32 txId = keccak256(abi.encodePacked(
            msg.sender, _receiver, msg.value, block.timestamp, totalTransactions
        ));
        
        uint256 riskScore = calculateRiskScore(msg.sender, _receiver, msg.value);
        
        transactions[txId] = StreamTransaction({
            txId: txId,
            sender: msg.sender,
            receiver: _receiver,
            value: msg.value,
            state: TransactionState.RECEIVED,
            arrivalTime: block.timestamp,
            riskScore: riskScore,
            riskLevel: determineRiskLevel(riskScore),
            complexity: ComplexityClass(_complexity),
            confidenceScore: 0,
            validationCount: 0,
            finalityTime: 0
        });
        
        transactionQueue.push(txId);
        totalTransactions++;
        
        emit TransactionReceived(txId, msg.sender, _receiver, msg.value);
        
        // Auto-progress to validation
        updateTransactionState(txId, uint8(TransactionState.VALIDATED));
    }

    function updateTransactionState(bytes32 _txId, uint8 _newState) public onlyConsensusCore {
        transactions[_txId].state = TransactionState(_newState);
        emit TransactionStateChanged(_txId, TransactionState(_newState), transactions[_txId].confidenceScore);
    }

    function updateConfidence(bytes32 _txId, uint256 _confidence) external onlyConsensusCore {
        transactions[_txId].confidenceScore = _confidence;
        
        if (_confidence >= 9900 && transactions[_txId].state != TransactionState.COMMITTED) {
            transactions[_txId].state = TransactionState.COMMITTED;
            emit TransactionStateChanged(_txId, TransactionState.COMMITTED, _confidence);
        }
        
        if (_confidence >= 9999 && transactions[_txId].state != TransactionState.FINALIZED) {
            transactions[_txId].state = TransactionState.FINALIZED;
            transactions[_txId].finalityTime = block.timestamp;
            emit TransactionStateChanged(_txId, TransactionState.FINALIZED, _confidence);
        }
    }

    function getTransaction(bytes32 _txId) external view returns (
        address sender,
        address receiver,
        uint256 value,
        TransactionState state,
        uint256 confidenceScore,
        uint256 validationCount
    ) {
        StreamTransaction storage tx = transactions[_txId];
        return (tx.sender, tx.receiver, tx.value, tx.state, tx.confidenceScore, tx.validationCount);
    }

    function getTransactionConfidence(bytes32 _txId) external view returns (
        uint256 confidence,
        TransactionState state,
        uint256 validationCount,
        bool isFinalized
    ) {
        StreamTransaction storage tx = transactions[_txId];
        return (tx.confidenceScore, tx.state, tx.validationCount, (tx.state == TransactionState.FINALIZED));
    }

    function calculateRiskScore(address _sender, address _receiver, uint256 _value) internal view returns (uint256) {
        uint256 riskScore = 100;
        if (_value > 1 ether) riskScore = riskScore.add(200);
        if (_value > 10 ether) riskScore = riskScore.add(300);
        return riskScore > 1000 ? 1000 : riskScore;
    }

    function determineRiskLevel(uint256 _riskScore) internal pure returns (RiskLevel) {
        if (_riskScore < 300) return RiskLevel.MINIMAL;
        if (_riskScore < 700) return RiskLevel.STANDARD;
        return RiskLevel.ENHANCED;
    }
}

/**
 * @title ValidatorManager
 * @dev Handles validator registration and management
 */
contract ValidatorManager is Ownable {
    using SafeMath for uint256;

    struct Validator {
        address validatorAddress;
        uint256 reputation;
        uint256 stake;
        bool isActive;
        uint256 totalValidations;
        uint256 correctValidations;
        uint256 lastActivityTime;
    }

    mapping(address => Validator) public validators;
    address[] public validatorList;
    uint256 public totalValidators;
    uint256 public constant BASE_REPUTATION = 500;

    address public consensusCore;

    event ValidatorRegistered(address indexed validator, uint256 stake);
    event ReputationUpdated(address indexed validator, uint256 newReputation);

    constructor() Ownable(msg.sender) {}

    modifier onlyConsensusCore() {
        require(msg.sender == consensusCore, "Only consensus core");
        _;
    }

    function setConsensusCore(address _consensusCore) external onlyOwner {
        consensusCore = _consensusCore;
    }

    function registerValidator() external payable {
        require(msg.value >= 0.1 ether, "Minimum stake required");
        require(!validators[msg.sender].isActive, "Validator already registered");
        
        validators[msg.sender] = Validator({
            validatorAddress: msg.sender,
            reputation: BASE_REPUTATION,
            stake: msg.value,
            isActive: true,
            totalValidations: 0,
            correctValidations: 0,
            lastActivityTime: block.timestamp
        });
        
        validatorList.push(msg.sender);
        totalValidators++;
        
        emit ValidatorRegistered(msg.sender, msg.value);
    }

    function updateValidatorActivity(address _validator) external onlyConsensusCore {
        validators[_validator].totalValidations++;
        validators[_validator].lastActivityTime = block.timestamp;
    }

    function updateReputation(address _validator, uint256 _newReputation) external onlyConsensusCore {
        validators[_validator].reputation = _newReputation;
        emit ReputationUpdated(_validator, _newReputation);
    }

    function isValidator(address _validator) external view returns (bool) {
        return validators[_validator].isActive;
    }

    function getValidatorReputation(address _validator) external view returns (uint256) {
        return validators[_validator].reputation;
    }

    function getValidatorMetrics(address _validator) external view returns (
        uint256 reputation,
        uint256 totalValidations,
        uint256 accuracy,
        bool isActive,
        uint256 stake
    ) {
        Validator storage validator = validators[_validator];
        uint256 accuracyCalc = validator.totalValidations > 0 ? 
            (validator.correctValidations.mul(10000)).div(validator.totalValidations) : 0;
        return (validator.reputation, validator.totalValidations, accuracyCalc, validator.isActive, validator.stake);
    }

    function getActiveValidatorCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) count++;
        }
        return count;
    }

    function getAverageReputation() external view returns (uint256) {
        uint256 totalRep = 0;
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                totalRep = totalRep.add(validators[validatorList[i]].reputation);
                activeCount++;
            }
        }
        
        return activeCount > 0 ? totalRep.div(activeCount) : 0;
    }
}

/**
 * @title ConsensusEngine
 * @dev Handles validation decisions and consensus logic
 */
contract ConsensusEngine is Ownable {
    using SafeMath for uint256;

    struct ValidationDecision {
        address validator;
        bytes32 txId;
        bool isValid;
        uint256 timestamp;
    }

    struct QuorumSignal {
        address validator;
        uint256 signalStrength;
        uint256 timestamp;
        bytes32 networkState;
    }

    mapping(bytes32 => ValidationDecision[]) public validationHistory;
    mapping(address => QuorumSignal[]) public quorumSignals;

    address public transactionManager;
    address public validatorManager;
    
    event ValidationCompleted(bytes32 indexed txId, address validator, bool isValid);
    event QuorumSignalBroadcast(address indexed validator, uint256 signalStrength);
    event ConsensusReached(bytes32 indexed txId, uint256 finalConfidence);

    constructor() Ownable(msg.sender) {}

    function setTransactionManager(address _transactionManager) external onlyOwner {
        transactionManager = _transactionManager;
    }

    function setValidatorManager(address _validatorManager) external onlyOwner {
        validatorManager = _validatorManager;
    }

    function validateTransaction(bytes32 _txId, bool _isValid) external {
        require(ValidatorManager(validatorManager).isValidator(msg.sender), "Not an active validator");
        
        validationHistory[_txId].push(ValidationDecision({
            validator: msg.sender,
            txId: _txId,
            isValid: _isValid,
            timestamp: block.timestamp
        }));
        
        ValidatorManager(validatorManager).updateValidatorActivity(msg.sender);
        emit ValidationCompleted(_txId, msg.sender, _isValid);
        
        checkConsensus(_txId);
    }

    function broadcastQuorumSignal(uint256 _signalStrength) external {
        require(ValidatorManager(validatorManager).isValidator(msg.sender), "Not an active validator");
        require(_signalStrength <= 1000, "Invalid signal strength");
        
        bytes32 networkState = calculateNetworkState();
        
        quorumSignals[msg.sender].push(QuorumSignal({
            validator: msg.sender,
            signalStrength: _signalStrength,
            timestamp: block.timestamp,
            networkState: networkState
        }));
        
        emit QuorumSignalBroadcast(msg.sender, _signalStrength);
    }

    function checkConsensus(bytes32 _txId) internal {
        ValidationDecision[] storage decisions = validationHistory[_txId];
        uint256 validCount = 0;
        uint256 totalWeight = 0;
        
        for (uint256 i = 0; i < decisions.length; i++) {
            uint256 validatorRep = ValidatorManager(validatorManager).getValidatorReputation(decisions[i].validator);
            totalWeight = totalWeight.add(validatorRep);
            if (decisions[i].isValid) {
                validCount = validCount.add(validatorRep);
            }
        }
        
        if (totalWeight > 0) {
            uint256 consensus = (validCount.mul(10000)).div(totalWeight);
            StreamTransactionManager(transactionManager).updateConfidence(_txId, consensus);
            
            if (consensus >= 9999) {
                emit ConsensusReached(_txId, consensus);
            }
        }
    }

    function calculateNetworkState() internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            block.timestamp,
            ValidatorManager(validatorManager).totalValidators(),
            block.difficulty
        ));
    }
}

/**
 * @title PerformanceTracker
 * @dev Tracks system performance metrics
 */
contract PerformanceTracker is Ownable {
    using SafeMath for uint256;

    uint256 public totalTransactions;
    uint256 public successfulTransactions;
    uint256 public avgProcessingTime;
    uint256 public deploymentTime;

    address public consensusCore;

    constructor() Ownable(msg.sender) {
        deploymentTime = block.timestamp;
    }

    function setConsensusCore(address _consensusCore) external onlyOwner {
        consensusCore = _consensusCore;
    }

    function recordTransaction(bool _success, uint256 _processingTime) external {
        require(msg.sender == consensusCore, "Only consensus core");
        
        totalTransactions++;
        if (_success) successfulTransactions++;
        
        // Update average processing time
        if (totalTransactions == 1) {
            avgProcessingTime = _processingTime;
        } else {
            avgProcessingTime = (avgProcessingTime.mul(totalTransactions.sub(1)).add(_processingTime)).div(totalTransactions);
        }
    }

    function getDetailedSystemStats() external view returns (
        uint256 _totalTx,
        uint256 _totalValidators,
        uint256 _successRate,
        uint256 _avgProcessingTime,
        uint256 _systemUptime,
        uint256 _consensusEfficiency
    ) {
        return (
            totalTransactions,
            ValidatorManager(ValidatorManager(consensusCore)).totalValidators(),
            totalTransactions > 0 ? (successfulTransactions.mul(10000)).div(totalTransactions) : 0,
            avgProcessingTime,
            block.timestamp.sub(deploymentTime),
            calculateConsensusEfficiency()
        );
    }

    function calculateConsensusEfficiency() internal view returns (uint256) {
        return totalTransactions > 0 ? (successfulTransactions.mul(10000)).div(totalTransactions) : 0;
    }
}

/**
 * @title EconomicsEngine  
 * @dev Handles Nash equilibrium and fee calculations
 */
contract EconomicsEngine is Ownable {
    using SafeMath for uint256;

    address public validatorManager;
    
    event NashEquilibriumReached(uint256 price, uint256 validators);

    constructor() Ownable(msg.sender) {}

    function setValidatorManager(address _validatorManager) external onlyOwner {
        validatorManager = _validatorManager;
    }

    function calculateValidationFee(uint256 _complexity, bool _urgent) external pure returns (uint256) {
        uint256 baseFee = 0.001 ether;
        return baseFee.mul(_complexity.add(1)).mul(_urgent ? 2 : 1);
    }

    function proposeNashEquilibrium(uint256 _validationPrice, uint256 _expectedValidators) external returns (bool) {
        require(ValidatorManager(validatorManager).isValidator(msg.sender), "Not an active validator");
        
        uint256 currentValidators = ValidatorManager(validatorManager).getActiveValidatorCount();
        uint256 optimalPrice = calculateOptimalValidationPrice();
        
        bool priceEquilibrium = _validationPrice >= optimalPrice;
        bool participationEquilibrium = currentValidators >= 3 && currentValidators <= _expectedValidators.add(2);
        
        bool equilibriumReached = priceEquilibrium && participationEquilibrium;
        
        if (equilibriumReached) {
            emit NashEquilibriumReached(_validationPrice, currentValidators);
        }
        
        return equilibriumReached;
    }

    function calculateOptimalValidationPrice() internal pure returns (uint256) {
        return 0.001 ether;
    }
}

/**
 * @title StreamBasedConsensusCore
 * @dev Main coordinator contract that orchestrates all components
 */
contract StreamBasedConsensusCore is Ownable {
    using SafeMath for uint256;

    StreamTransactionManager public transactionManager;
    ValidatorManager public validatorManager;
    ConsensusEngine public consensusEngine;
    PerformanceTracker public performanceTracker;
    EconomicsEngine public economicsEngine;

    bytes32 public globalRollingHash;
    uint256 public quorumThreshold = 670;

    event RollingHashUpdated(bytes32 newHash, uint256 timestamp);
    event SystemInitialized();

    constructor() Ownable(msg.sender) {
        globalRollingHash = keccak256(abi.encodePacked("STREBACOM_GENESIS", block.timestamp));
        emit RollingHashUpdated(globalRollingHash, block.timestamp);
    }

    function initializeSystem(
        address _transactionManager,
        address _validatorManager,
        address _consensusEngine,
        address _performanceTracker,
        address _economicsEngine
    ) external onlyOwner {
        transactionManager = StreamTransactionManager(_transactionManager);
        validatorManager = ValidatorManager(_validatorManager);
        consensusEngine = ConsensusEngine(_consensusEngine);
        performanceTracker = PerformanceTracker(_performanceTracker);
        economicsEngine = EconomicsEngine(_economicsEngine);
        
        // Set up inter-contract references
        transactionManager.setConsensusCore(address(this));
        transactionManager.setValidatorManager(address(validatorManager));
        
        validatorManager.setConsensusCore(address(this));
        
        consensusEngine.setTransactionManager(address(transactionManager));
        consensusEngine.setValidatorManager(address(validatorManager));
        
        performanceTracker.setConsensusCore(address(this));
        economicsEngine.setValidatorManager(address(validatorManager));
        
        emit SystemInitialized();
    }

    function updateRollingHash(bytes32 _txId) external {
        require(msg.sender == address(consensusEngine), "Only consensus engine");
        
        globalRollingHash = keccak256(abi.encodePacked(globalRollingHash, _txId, block.timestamp));
        emit RollingHashUpdated(globalRollingHash, block.timestamp);
    }

    function updateQuorumThreshold(uint256 _newThreshold) external onlyOwner {
        require(_newThreshold >= 500 && _newThreshold <= 900, "Invalid threshold");
        quorumThreshold = _newThreshold;
    }

    // Proxy functions for easy access
    function getDetailedSystemStats() external view returns (
        uint256 _totalTx,
        uint256 _totalValidators, 
        uint256 _successRate,
        uint256 _avgProcessingTime,
        uint256 _systemUptime,
        uint256 _consensusEfficiency
    ) {
        return performanceTracker.getDetailedSystemStats();
    }
}