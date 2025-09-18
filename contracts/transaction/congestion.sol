// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AdjustableLayer1Blockchain
 * @dev Implementation of the fully adjustable Layer 1 blockchain with infinite resizing,
 * adaptive compression, and dual-layer transaction halving as described in the paper
 */
contract AdjustableLayer1Blockchain {
    
    // Owner for administrative functions
    address public owner;
    
    // Transaction States (Six-state lifecycle model)
    enum TransactionState {
        Pending,      // S1: Initial state
        Compressed,   // S2: After compression
        Moving,       // S3: In transit
        Stacked,      // S4: Buffered for block inclusion
        Decompressed, // S5: Restored to original form
        Validated     // S6: Finalized on blockchain
    }
    
    // Transaction priority levels
    enum Priority {
        Critical,     // System critical transactions
        Urgent,       // Time-sensitive operations
        Economic,     // High-value transactions
        Standard,     // Regular transactions
        Low          // Low-priority transactions
    }
    
    // Dual-layer transaction structure (PT and FT)
    struct Transaction {
        uint256 txId;
        address sender;
        address receiver;
        uint256 amount;
        uint256 timestamp;
        uint256 compressionRatio;  // Compression factor Cf
        Priority priority;
        TransactionState state;
        bytes32 primaryHash;        // PT: Essential data hash
        bytes32 flattenedHash;      // FT: Secondary data hash
        bool isCompressed;
        uint256 batchId;           // Batch this tx belongs to
    }
    
    // Batch structure for grouped transactions
    struct Batch {
        uint256 batchId;
        uint256[] transactionIds;
        uint256 creationTime;
        uint256 totalSize;
        uint256 compressedSize;
        bool isProcessed;
        uint256 priorityScore;
    }
    
    // Virtual Data Table (VDT) for mapping compression states
    struct VirtualDataTable {
        bytes32 originalHash;
        bytes32 compressedHash;
        uint256 compressionTimestamp;
        uint256 restorationRules;  // Encoded restoration parameters
    }
    
    // System metrics for monitoring
    struct SystemMetrics {
        uint256 totalTransactions;
        uint256 totalBatches;
        uint256 averageCompressionRatio;
        uint256 currentNetworkLoad;
        uint256 totalCompressed;
        uint256 totalValidated;
    }
    
    // Storage
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => Batch) public batches;
    mapping(uint256 => VirtualDataTable) public vdtMappings;
    mapping(address => uint256[]) public userTransactions;
    
    uint256 public transactionCounter;
    uint256 public batchCounter;
    uint256 public currentChannelBandwidth = 1000; // Dynamic bandwidth
    uint256 public compressionThreshold = 70; // Network load threshold for compression
    
    SystemMetrics public systemMetrics;
    
    // Modular layers for infinite space management
    uint256 public activeModularLayers = 1;
    uint256 public maxTransactionsPerLayer = 100;
    
    // Events
    event TransactionSubmitted(uint256 indexed txId, address indexed sender, Priority priority);
    event BatchCreated(uint256 indexed batchId, uint256 transactionCount);
    event TransactionCompressed(uint256 indexed txId, uint256 compressionRatio);
    event TransactionStateChanged(uint256 indexed txId, TransactionState newState);
    event ChannelBandwidthAdjusted(uint256 newBandwidth);
    event ModularLayerAdded(uint256 newLayerCount);
    event TransactionValidated(uint256 indexed txId, bytes32 finalHash);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @dev Submit a new transaction to the system
     */
    function submitTransaction(
        address _receiver,
        uint256 _amount,
        Priority _priority
    ) external returns (uint256) {
        transactionCounter++;
        
        // Create transaction with dual-layer structure
        Transaction storage newTx = transactions[transactionCounter];
        newTx.txId = transactionCounter;
        newTx.sender = msg.sender;
        newTx.receiver = _receiver;
        newTx.amount = _amount;
        newTx.timestamp = block.timestamp;
        newTx.priority = _priority;
        newTx.state = TransactionState.Pending;
        newTx.isCompressed = false;
        
        // Generate PT and FT hashes (dual-layer)
        newTx.primaryHash = keccak256(abi.encodePacked(_receiver, _amount, block.timestamp));
        newTx.flattenedHash = keccak256(abi.encodePacked(msg.sender, _priority, transactionCounter));
        
        userTransactions[msg.sender].push(transactionCounter);
        systemMetrics.totalTransactions++;
        
        // Check if new modular layer needed (infinite space management)
        _checkModularLayerExpansion();
        
        emit TransactionSubmitted(transactionCounter, msg.sender, _priority);
        
        return transactionCounter;
    }
    
    /**
     * @dev Create a batch of transactions for processing
     */
    function createBatch(uint256[] memory _txIds) external returns (uint256) {
        require(_txIds.length > 0, "Empty batch");
        
        batchCounter++;
        Batch storage newBatch = batches[batchCounter];
        newBatch.batchId = batchCounter;
        newBatch.transactionIds = _txIds;
        newBatch.creationTime = block.timestamp;
        
        uint256 totalPriority = 0;
        uint256 totalSize = 0;
        
        for (uint256 i = 0; i < _txIds.length; i++) {
            Transaction storage tx = transactions[_txIds[i]];
            require(tx.state == TransactionState.Pending, "Invalid tx state");
            
            tx.batchId = batchCounter;
            totalPriority += uint256(tx.priority);
            totalSize += 256; // Simulated size in bytes
        }
        
        newBatch.totalSize = totalSize;
        newBatch.priorityScore = totalPriority / _txIds.length;
        systemMetrics.totalBatches++;
        
        emit BatchCreated(batchCounter, _txIds.length);
        
        return batchCounter;
    }
    
    /**
     * @dev Compress transactions in a batch (adaptive compression)
     */
    function compressBatch(uint256 _batchId) external {
        Batch storage batch = batches[_batchId];
        require(!batch.isProcessed, "Batch already processed");
        
        uint256 networkLoad = _calculateNetworkLoad();
        uint256 compressionFactor = _calculateCompressionFactor(networkLoad);
        
        for (uint256 i = 0; i < batch.transactionIds.length; i++) {
            Transaction storage tx = transactions[batch.transactionIds[i]];
            
            // Apply compression based on priority
            if (uint256(tx.priority) > uint256(Priority.Urgent)) {
                tx.compressionRatio = compressionFactor;
                tx.isCompressed = true;
                tx.state = TransactionState.Compressed;
                
                // Create VDT mapping
                _createVDTMapping(tx.txId, tx.primaryHash);
                
                systemMetrics.totalCompressed++;
                emit TransactionCompressed(tx.txId, compressionFactor);
                emit TransactionStateChanged(tx.txId, TransactionState.Compressed);
            }
        }
        
        batch.compressedSize = (batch.totalSize * (100 - compressionFactor)) / 100;
        systemMetrics.averageCompressionRatio = compressionFactor;
    }
    
    /**
     * @dev Move transactions through the channel (Moving state)
     */
    function moveTransactions(uint256 _batchId) external {
        Batch storage batch = batches[_batchId];
        require(batch.batchId != 0, "Invalid batch");
        
        // Adjust channel bandwidth dynamically
        _adjustChannelBandwidth();
        
        for (uint256 i = 0; i < batch.transactionIds.length; i++) {
            Transaction storage tx = transactions[batch.transactionIds[i]];
            require(tx.state == TransactionState.Compressed || tx.state == TransactionState.Pending, "Invalid state");
            
            tx.state = TransactionState.Moving;
            emit TransactionStateChanged(tx.txId, TransactionState.Moving);
        }
    }
    
    /**
     * @dev Stack transactions for block inclusion
     */
    function stackTransactions(uint256 _batchId) external {
        Batch storage batch = batches[_batchId];
        
        for (uint256 i = 0; i < batch.transactionIds.length; i++) {
            Transaction storage tx = transactions[batch.transactionIds[i]];
            require(tx.state == TransactionState.Moving, "Not in moving state");
            
            tx.state = TransactionState.Stacked;
            emit TransactionStateChanged(tx.txId, TransactionState.Stacked);
        }
    }
    
    /**
     * @dev Decompress transactions (restoration)
     */
    function decompressTransactions(uint256 _batchId) external {
        Batch storage batch = batches[_batchId];
        
        for (uint256 i = 0; i < batch.transactionIds.length; i++) {
            Transaction storage tx = transactions[batch.transactionIds[i]];
            require(tx.state == TransactionState.Stacked, "Not stacked");
            
            if (tx.isCompressed) {
                // Restore from VDT
                VirtualDataTable memory vdt = vdtMappings[tx.txId];
                require(vdt.originalHash != bytes32(0), "VDT mapping not found");
                
                tx.isCompressed = false;
                tx.compressionRatio = 0;
            }
            
            tx.state = TransactionState.Decompressed;
            emit TransactionStateChanged(tx.txId, TransactionState.Decompressed);
        }
    }
    
    /**
     * @dev Validate transactions (final state)
     */
    function validateTransactions(uint256 _batchId) external {
        Batch storage batch = batches[_batchId];
        require(!batch.isProcessed, "Already validated");
        
        for (uint256 i = 0; i < batch.transactionIds.length; i++) {
            Transaction storage tx = transactions[batch.transactionIds[i]];
            require(tx.state == TransactionState.Decompressed, "Not decompressed");
            
            // Final validation
            bytes32 finalHash = keccak256(
                abi.encodePacked(tx.primaryHash, tx.flattenedHash, block.timestamp)
            );
            
            tx.state = TransactionState.Validated;
            systemMetrics.totalValidated++;
            
            emit TransactionStateChanged(tx.txId, TransactionState.Validated);
            emit TransactionValidated(tx.txId, finalHash);
        }
        
        batch.isProcessed = true;
    }
    
    /**
     * @dev Calculate network load
     */
    function _calculateNetworkLoad() private view returns (uint256) {
        uint256 pendingTxs = systemMetrics.totalTransactions - systemMetrics.totalValidated;
        uint256 load = (pendingTxs * 100) / (maxTransactionsPerLayer * activeModularLayers);
        return load > 100 ? 100 : load;
    }
    
    /**
     * @dev Calculate compression factor based on network load
     */
    function _calculateCompressionFactor(uint256 _networkLoad) private view returns (uint256) {
        if (_networkLoad < compressionThreshold) {
            return 30; // Low compression
        } else if (_networkLoad < 85) {
            return 50; // Medium compression
        } else {
            return 70; // High compression
        }
    }
    
    /**
     * @dev Create Virtual Data Table mapping
     */
    function _createVDTMapping(uint256 _txId, bytes32 _originalHash) private {
        VirtualDataTable storage vdt = vdtMappings[_txId];
        vdt.originalHash = _originalHash;
        vdt.compressedHash = keccak256(abi.encodePacked(_originalHash, block.timestamp));
        vdt.compressionTimestamp = block.timestamp;
        vdt.restorationRules = 1; // Simplified restoration rule encoding
    }
    
    /**
     * @dev Adjust channel bandwidth dynamically
     */
    function _adjustChannelBandwidth() private {
        uint256 networkLoad = _calculateNetworkLoad();
        
        if (networkLoad > 80) {
            currentChannelBandwidth = (currentChannelBandwidth * 120) / 100; // Increase 20%
        } else if (networkLoad < 30) {
            currentChannelBandwidth = (currentChannelBandwidth * 80) / 100; // Decrease 20%
        }
        
        emit ChannelBandwidthAdjusted(currentChannelBandwidth);
    }
    
    /**
     * @dev Check if new modular layer needed (infinite space management)
     */
    function _checkModularLayerExpansion() private {
        uint256 currentCapacity = activeModularLayers * maxTransactionsPerLayer;
        uint256 utilizationRate = (systemMetrics.totalTransactions * 100) / currentCapacity;
        
        if (utilizationRate > 75) {
            activeModularLayers++;
            emit ModularLayerAdded(activeModularLayers);
        }
    }
    
    /**
     * @dev Get system statistics
     */
    function getSystemStats() external view returns (
        uint256 totalTx,
        uint256 totalBatches,
        uint256 avgCompression,
        uint256 networkLoad,
        uint256 validated,
        uint256 layers
    ) {
        return (
            systemMetrics.totalTransactions,
            systemMetrics.totalBatches,
            systemMetrics.averageCompressionRatio,
            _calculateNetworkLoad(),
            systemMetrics.totalValidated,
            activeModularLayers
        );
    }
    
    /**
     * @dev Get transaction details
     */
    function getTransaction(uint256 _txId) external view returns (
        address sender,
        address receiver,
        uint256 amount,
        TransactionState state,
        Priority priority,
        bool compressed
    ) {
        Transaction memory tx = transactions[_txId];
        return (
            tx.sender,
            tx.receiver,
            tx.amount,
            tx.state,
            tx.priority,
            tx.isCompressed
        );
    }
}