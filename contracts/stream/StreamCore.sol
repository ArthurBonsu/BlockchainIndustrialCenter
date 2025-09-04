// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Strebacom Core - Stream-Based Consensus Demonstration
 * @notice Demonstrates key innovations from Stream-Based Consensus Model research
 * @dev Focus on core concepts: stream processing, probabilistic finality, quorum sensing
 */
contract StrebacomCore {
    
    // Core Strebacom Innovation 1: Stream Transaction Structure
    struct StreamTransaction {
        bytes32 txId;
        address sender;
        address receiver;
        uint256 value;
        uint256 arrivalTime;
        uint256 confidenceScore;  // Probabilistic finality innovation
        uint8 state; // RECEIVED=0, VALIDATED=1, CONSENSUS=2, FINALIZED=3
        uint256 validatorCount;
        bool isFinalized;
    }
    
    // Core Strebacom Innovation 2: Validator with Reputation
    struct StreamValidator {
        address validatorAddress;
        uint256 reputation; // Starts at 100, can go 0-200
        uint256 stake;
        uint256 totalValidations;
        uint256 correctValidations;
        bool isActive;
    }
    
    // Core Strebacom Innovation 3: Quorum Signal for Consensus
    struct QuorumSignal {
        address validator;
        bytes32 txId;
        uint256 signalStrength; // 0-100
        uint256 timestamp;
        bool decision; // validate or reject
    }
    
    // Storage
    mapping(bytes32 => StreamTransaction) public transactions;
    mapping(address => StreamValidator) public validators;
    mapping(bytes32 => QuorumSignal[]) public quorumSignals;
    
    bytes32[] public transactionStream; // Continuous stream, not blocks
    address[] public validatorList;
    
    // Core Strebacom Innovation 4: Rolling Hash Commitment (blockless)
    bytes32 public globalRollingHash;
    uint256 public hashUpdateCount;
    
    // System metrics for research validation
    uint256 public totalTransactions;
    uint256 public finalizedTransactions;
    uint256 public averageConfidenceTime;
    
    // Constants for Strebacom model
    uint256 public constant FINALITY_THRESHOLD = 90; // 90% confidence for finality
    uint256 public constant QUORUM_THRESHOLD = 51; // 51% vs traditional 67%
    uint256 public constant BASE_REPUTATION = 100;
    
    // Events for research tracking
    event StreamTransactionReceived(bytes32 indexed txId, address sender, uint256 value);
    event ConfidenceUpdated(bytes32 indexed txId, uint256 confidence, uint8 state);
    event QuorumSignalBroadcast(address indexed validator, bytes32 indexed txId, uint256 signalStrength);
    event ProbabilisticFinalityReached(bytes32 indexed txId, uint256 finalConfidence);
    event RollingHashUpdated(bytes32 newHash, uint256 updateCount);
    
    constructor() {
        globalRollingHash = keccak256(abi.encodePacked(block.timestamp, block.difficulty));
        hashUpdateCount = 0;
    }
    
    // Core Innovation: Register Stream Validator (reputation-based)
    function registerStreamValidator() external payable {
        require(msg.value >= 0.01 ether, "Minimum stake required");
        require(!validators[msg.sender].isActive, "Already registered");
        
        validators[msg.sender] = StreamValidator({
            validatorAddress: msg.sender,
            reputation: BASE_REPUTATION,
            stake: msg.value,
            totalValidations: 0,
            correctValidations: 0,
            isActive: true
        });
        
        validatorList.push(msg.sender);
    }
    
    // Core Innovation: Submit Transaction to Stream (not block)
    function submitStreamTransaction(address _receiver) external payable returns (bytes32) {
        bytes32 txId = keccak256(abi.encodePacked(
            msg.sender, 
            _receiver, 
            msg.value, 
            block.timestamp, 
            totalTransactions
        ));
        
        transactions[txId] = StreamTransaction({
            txId: txId,
            sender: msg.sender,
            receiver: _receiver,
            value: msg.value,
            arrivalTime: block.timestamp,
            confidenceScore: 0,
            state: 0, // RECEIVED
            validatorCount: 0,
            isFinalized: false
        });
        
        transactionStream.push(txId);
        totalTransactions++;
        
        // Update rolling hash immediately (continuous, not batched)
        updateRollingHash(txId);
        
        emit StreamTransactionReceived(txId, msg.sender, msg.value);
        return txId;
    }
    
    // Core Innovation: Quorum-Sensing Validation (not voting rounds)
    function broadcastQuorumSignal(
        bytes32 _txId, 
        bool _decision, 
        uint256 _signalStrength
    ) external {
        require(validators[msg.sender].isActive, "Not active validator");
        require(transactions[_txId].sender != address(0), "Transaction not found");
        require(_signalStrength <= 100, "Signal strength must be 0-100");
        
        // Record the quorum signal
        quorumSignals[_txId].push(QuorumSignal({
            validator: msg.sender,
            txId: _txId,
            signalStrength: _signalStrength,
            timestamp: block.timestamp,
            decision: _decision
        }));
        
        // Update validator metrics
        validators[msg.sender].totalValidations++;
        
        // Calculate new confidence score using Strebacom model
        uint256 newConfidence = calculateStreamConfidence(_txId);
        transactions[_txId].confidenceScore = newConfidence;
        transactions[_txId].validatorCount++;
        
        // State progression based on confidence
        if (newConfidence >= 25 && transactions[_txId].state == 0) {
            transactions[_txId].state = 1; // VALIDATED
        }
        if (newConfidence >= 60 && transactions[_txId].state == 1) {
            transactions[_txId].state = 2; // CONSENSUS
        }
        if (newConfidence >= FINALITY_THRESHOLD && transactions[_txId].state == 2) {
            transactions[_txId].state = 3; // FINALIZED
            transactions[_txId].isFinalized = true;
            finalizedTransactions++;
            emit ProbabilisticFinalityReached(_txId, newConfidence);
        }
        
        emit QuorumSignalBroadcast(msg.sender, _txId, _signalStrength);
        emit ConfidenceUpdated(_txId, newConfidence, transactions[_txId].state);
    }
    
    // Core Innovation: Probabilistic Confidence Calculation (not binary finality)
      function calculateStreamConfidence(bytes32 _txId) public view returns (uint256) {
    QuorumSignal[] memory signals = quorumSignals[_txId];
    if (signals.length == 0) return 0;
    
    uint256 totalWeight = 0;
    uint256 positiveWeight = 0;
    
    for (uint i = 0; i < signals.length; i++) {
        address validator = signals[i].validator;
        uint256 reputation = validators[validator].reputation;
        uint256 stake = validators[validator].stake;
        
        // Fix: Don't divide by 1e18, it makes weight too small
        uint256 weight = reputation; // Simplified for testing
        totalWeight += weight;
        
        if (signals[i].decision) {
            positiveWeight += (weight * signals[i].signalStrength) / 100;
        }
    }
    
    if (totalWeight == 0) return 0;
    return (positiveWeight * 100) / totalWeight;
}
    
    // Core Innovation: Continuous Rolling Hash (no blocks)
    function updateRollingHash(bytes32 _txId) internal {
        globalRollingHash = keccak256(abi.encodePacked(
            globalRollingHash,
            _txId,
            block.timestamp
        ));
        hashUpdateCount++;
        emit RollingHashUpdated(globalRollingHash, hashUpdateCount);
    }
    
    // Research Validation: Get transaction confidence and state
    function getTransactionStatus(bytes32 _txId) external view returns (
        uint256 confidence,
        uint8 state,
        bool isFinalized,
        uint256 validatorCount,
        uint256 timeToFinality
    ) {
        StreamTransaction memory tx = transactions[_txId];
        uint256 finality = tx.isFinalized ? (block.timestamp - tx.arrivalTime) : 0;
        
        return (
            tx.confidenceScore,
            tx.state,
            tx.isFinalized,
            tx.validatorCount,
            finality
        );
    }
    
    // Research Validation: System Performance Metrics
    function getStrebacomMetrics() external view returns (
        uint256 _totalTransactions,
        uint256 _finalizedTransactions,
        uint256 _activeValidators,
        uint256 _averageFinality,
        uint256 _hashUpdates,
        uint256 _consensusEfficiency
    ) {
        uint256 activeValidators = 0;
        for (uint i = 0; i < validatorList.length; i++) {
            if (validators[validatorList[i]].isActive) {
                activeValidators++;
            }
        }
        
        uint256 efficiency = totalTransactions > 0 ? 
            (finalizedTransactions * 100) / totalTransactions : 0;
            
        return (
            totalTransactions,
            finalizedTransactions,
            activeValidators,
            averageConfidenceTime,
            hashUpdateCount,
            efficiency
        );
    }
    
    // Research Validation: Compare vs Traditional Blockchain
    function getComparisonMetrics() external pure returns (
        string memory consensusType,
        string memory architecture,
        uint256 byzantineThreshold,
        string memory finalityType,
        string memory processingModel
    ) {
        return (
            "Stream-Based Quorum Sensing",
            "Blockless Continuous Stream",
            51, // vs 67% in traditional BFT
            "Probabilistic with Confidence Scoring",
            "Individual Transaction Processing"
        );
    }
    
    // Research Validation: Get validator reputation metrics
    function getValidatorMetrics(address _validator) external view returns (
        uint256 reputation,
        uint256 totalValidations,
        uint256 accuracy,
        uint256 stake,
        bool isActive
    ) {
        StreamValidator memory v = validators[_validator];
        uint256 acc = v.totalValidations > 0 ? 
            (v.correctValidations * 100) / v.totalValidations : 0;
            
        return (v.reputation, v.totalValidations, acc, v.stake, v.isActive);
    }
    
    // Get stream transaction by index (for iteration)
    function getTransactionByIndex(uint256 _index) external view returns (bytes32) {
        require(_index < transactionStream.length, "Index out of bounds");
        return transactionStream[_index];
    }
    
    // Get total transaction count in stream
    function getTransactionStreamLength() external view returns (uint256) {
        return transactionStream.length;
    }


  
}