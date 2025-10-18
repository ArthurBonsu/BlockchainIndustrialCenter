// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title UISOrchestrator
 * @dev Main contract implementing the UIS blockchain orchestration layer
 * Minimized for deployment efficiency while demonstrating core concepts
 */
contract UISOrchestrator {
    
    // ==================== Data Structures ====================
    
    struct DataSource {
        string sourceType; // oracle, database, ai_model
        string schemaId;
        address owner;
        uint256 stake;
        uint256 reputation;
        bool isActive;
        bytes32 versionHash;
    }
    
    struct QueryTask {
        bytes32 queryHash;
        address requester;
        uint256 reward;
        TaskStatus status;
        uint256 timestamp;
        bytes32[] resultHashes;
        mapping(address => bytes32) nodeSubmissions;
    }
    
    struct TransformationRule {
        string fromSchema;
        string toSchema;
        uint256 confidence; // 0-100
        bytes32 ruleHash;
        bool bidirectional;
    }
    
    struct ProofRecord {
        bytes32 taskId;
        bytes32 outputHash;
        string evidencePointer; // IPFS CID
        address submitter;
        uint256 timestamp;
        bool verified;
    }
    
    struct NodeReputation {
        uint256 score; // 0-100
        uint256 totalTasks;
        uint256 successfulTasks;
        uint256 failedTasks;
        uint256 lastUpdate;
    }
    
    enum TaskStatus {
        Pending,
        Assigned,
        Completed,
        Disputed,
        Cancelled
    }
    
    // ==================== State Variables ====================
    
    mapping(address => DataSource) public dataSources;
    mapping(bytes32 => QueryTask) public queryTasks;
    mapping(bytes32 => TransformationRule) public transformationRules;
    mapping(bytes32 => ProofRecord) public proofRegistry;
    mapping(address => NodeReputation) public nodeReputations;
    mapping(address => uint256) public pendingRewards;
    
    // Temporary storage for consensus calculations
    mapping(bytes32 => mapping(bytes32 => uint256)) private tempHashWeights;
    mapping(bytes32 => uint256) private tempTotalWeights;
    
    address[] public registeredSources;
    bytes32[] public activeTasks;
    
    uint256 public totalQueries;
    uint256 public totalSources;
    uint256 public totalTransformations;
    uint256 public systemUptime;
    uint256 public deploymentTime;
    
    uint256 public constant MINIMUM_STAKE = 0.01 ether;
    uint256 public constant CONSENSUS_THRESHOLD = 66; // 66%
    uint256 public constant REPUTATION_THRESHOLD = 50;
    
    address public owner;
    
    // ==================== Events ====================
    
    event SourceRegistered(address indexed source, string sourceType, bytes32 versionHash);
    event QueryCreated(bytes32 indexed taskId, address indexed requester, uint256 reward);
    event ProofSubmitted(bytes32 indexed taskId, bytes32 outputHash, address submitter);
    event ConsensusReached(bytes32 indexed taskId, bytes32 consensusHash, uint256 agreementRatio);
    event RewardDistributed(address indexed node, uint256 amount);
    event TransformationRegistered(bytes32 ruleId, string fromSchema, string toSchema);
    
    // ==================== Constructor ====================
    
    constructor() {
        owner = msg.sender;
        deploymentTime = block.timestamp;
        systemUptime = 0;
        
        // Initialize with UIS core schema
        _registerCoreSchema();
    }
    
    // ==================== Core Functions ====================
    
    /**
     * @dev Register a new data source with stake
     */
    function registerDataSource(
        string memory sourceType,
        string memory schemaId,
        bytes32 versionHash
    ) external payable {
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        require(dataSources[msg.sender].owner == address(0), "Already registered");
        
        dataSources[msg.sender] = DataSource({
            sourceType: sourceType,
            schemaId: schemaId,
            owner: msg.sender,
            stake: msg.value,
            reputation: 50, // Start with neutral reputation
            isActive: true,
            versionHash: versionHash
        });
        
        nodeReputations[msg.sender] = NodeReputation({
            score: 50,
            totalTasks: 0,
            successfulTasks: 0,
            failedTasks: 0,
            lastUpdate: block.timestamp
        });
        
        registeredSources.push(msg.sender);
        totalSources++;
        
        emit SourceRegistered(msg.sender, sourceType, versionHash);
    }
    
    /**
     * @dev Create a new cross-system query task
     */
    function createQueryTask(
        bytes32 queryHash,
        uint256 timeout
    ) external payable returns (bytes32) {
        require(msg.value > 0, "Reward required");
        
        bytes32 taskId = keccak256(abi.encodePacked(queryHash, msg.sender, block.timestamp));
        
        QueryTask storage task = queryTasks[taskId];
        task.queryHash = queryHash;
        task.requester = msg.sender;
        task.reward = msg.value;
        task.status = TaskStatus.Pending;
        task.timestamp = block.timestamp;
        
        activeTasks.push(taskId);
        totalQueries++;
        
        emit QueryCreated(taskId, msg.sender, msg.value);
        
        return taskId;
    }
    
    /**
     * @dev Submit query result with proof
     */
    function submitQueryResult(
        bytes32 taskId,
        bytes32 outputHash,
        string memory evidencePointer
    ) external {
        require(dataSources[msg.sender].isActive, "Source not active");
        require(queryTasks[taskId].status == TaskStatus.Pending, "Invalid task status");
        
        QueryTask storage task = queryTasks[taskId];
        task.nodeSubmissions[msg.sender] = outputHash;
        task.resultHashes.push(outputHash);
        
        // Store proof
        bytes32 proofId = keccak256(abi.encodePacked(taskId, msg.sender));
        proofRegistry[proofId] = ProofRecord({
            taskId: taskId,
            outputHash: outputHash,
            evidencePointer: evidencePointer,
            submitter: msg.sender,
            timestamp: block.timestamp,
            verified: false
        });
        
        emit ProofSubmitted(taskId, outputHash, msg.sender);
        
        // Check for consensus
        _checkConsensus(taskId);
    }
    
    /**
     * @dev Register a schema transformation rule
     */
    function registerTransformation(
        string memory fromSchema,
        string memory toSchema,
        uint256 confidence,
        bytes32 ruleHash,
        bool bidirectional
    ) external {
        require(dataSources[msg.sender].isActive, "Only active sources can register");
        require(confidence <= 100, "Invalid confidence");
        
        bytes32 transformId = keccak256(abi.encodePacked(fromSchema, toSchema));
        
        transformationRules[transformId] = TransformationRule({
            fromSchema: fromSchema,
            toSchema: toSchema,
            confidence: confidence,
            ruleHash: ruleHash,
            bidirectional: bidirectional
        });
        
        totalTransformations++;
        
        emit TransformationRegistered(transformId, fromSchema, toSchema);
        
        if (bidirectional) {
            // Register reverse transformation
            bytes32 reverseId = keccak256(abi.encodePacked(toSchema, fromSchema));
            transformationRules[reverseId] = TransformationRule({
                fromSchema: toSchema,
                toSchema: fromSchema,
                confidence: confidence,
                ruleHash: ruleHash,
                bidirectional: true
            });
            totalTransformations++;
        }
    }
    
    // ==================== Consensus & Verification ====================
    
    /**
     * @dev Check consensus among submitted results
     */
    function _checkConsensus(bytes32 taskId) internal {
        QueryTask storage task = queryTasks[taskId];
        
        if (task.resultHashes.length < 2) return; // Need at least 2 submissions
        
        // Clear previous temp data for this task
        delete tempTotalWeights[taskId];
        
        uint256 totalWeight = 0;
        bytes32 winningHash;
        uint256 maxWeight = 0;
        
        // Calculate weighted votes
        for (uint256 i = 0; i < registeredSources.length; i++) {
            address source = registeredSources[i];
            bytes32 submittedHash = task.nodeSubmissions[source];
            
            if (submittedHash != bytes32(0)) {
                uint256 weight = _calculateNodeWeight(source);
                tempHashWeights[taskId][submittedHash] += weight;
                totalWeight += weight;
                
                if (tempHashWeights[taskId][submittedHash] > maxWeight) {
                    maxWeight = tempHashWeights[taskId][submittedHash];
                    winningHash = submittedHash;
                }
            }
        }
        
        // Store total weight for this task
        tempTotalWeights[taskId] = totalWeight;
        
        // Check if consensus reached
        uint256 agreementRatio = totalWeight > 0 ? (maxWeight * 100) / totalWeight : 0;
        
        if (agreementRatio >= CONSENSUS_THRESHOLD) {
            task.status = TaskStatus.Completed;
            
            // Mark proof as verified
            bytes32 proofId = keccak256(abi.encodePacked(taskId, msg.sender));
            proofRegistry[proofId].verified = true;
            
            emit ConsensusReached(taskId, winningHash, agreementRatio);
            
            // Distribute rewards
            _distributeRewards(taskId, winningHash);
            
            // Clean up temp storage
            for (uint256 i = 0; i < task.resultHashes.length; i++) {
                delete tempHashWeights[taskId][task.resultHashes[i]];
            }
            delete tempTotalWeights[taskId];
        }
    }
    
    /**
     * @dev Calculate node weight based on reputation and stake
     */
    function _calculateNodeWeight(address node) internal view returns (uint256) {
        DataSource memory source = dataSources[node];
        NodeReputation memory rep = nodeReputations[node];
        
        // Weight = 70% reputation + 30% stake
        uint256 repWeight = (rep.score * 70) / 100;
        uint256 stakeWeight = (source.stake * 30) / (1 ether);
        
        return repWeight + stakeWeight;
    }
    
    /**
     * @dev Distribute rewards to consensus participants
     */
    function _distributeRewards(bytes32 taskId, bytes32 winningHash) internal {
        QueryTask storage task = queryTasks[taskId];
        uint256 totalReward = task.reward;
        uint256 participantCount = 0;
        
        // Count consensus participants
        for (uint256 i = 0; i < registeredSources.length; i++) {
            address source = registeredSources[i];
            if (task.nodeSubmissions[source] == winningHash) {
                participantCount++;
            }
        }
        
        if (participantCount == 0) return;
        
        uint256 rewardPerNode = totalReward / participantCount;
        
        // Distribute rewards and update reputation
        for (uint256 i = 0; i < registeredSources.length; i++) {
            address source = registeredSources[i];
            bytes32 submittedHash = task.nodeSubmissions[source];
            
            if (submittedHash == winningHash) {
                // Reward consensus participants
                pendingRewards[source] += rewardPerNode;
                _updateReputation(source, true);
                emit RewardDistributed(source, rewardPerNode);
            } else if (submittedHash != bytes32(0)) {
                // Penalize dissenting nodes
                _updateReputation(source, false);
            }
        }
    }
    
    /**
     * @dev Update node reputation based on performance
     */
    function _updateReputation(address node, bool success) internal {
        NodeReputation storage rep = nodeReputations[node];
        
        rep.totalTasks++;
        
        if (success) {
            rep.successfulTasks++;
            // Increase reputation (max 100)
            if (rep.score < 95) {
                rep.score += 5;
            } else {
                rep.score = 100;
            }
        } else {
            rep.failedTasks++;
            // Decrease reputation (min 0)
            if (rep.score > 5) {
                rep.score -= 5;
            } else {
                rep.score = 0;
            }
        }
        
        rep.lastUpdate = block.timestamp;
        
        // Update source reputation
        dataSources[node].reputation = rep.score;
        
        // Deactivate if reputation too low
        if (rep.score < 20) {
            dataSources[node].isActive = false;
        }
    }
    
    // ==================== Query Functions ====================
    
    /**
     * @dev Get system statistics
     */
    function getSystemStats() external view returns (
        uint256 queries,
        uint256 sources,
        uint256 transformations,
        uint256 uptime,
        uint256 avgReputation
    ) {
        queries = totalQueries;
        sources = totalSources;
        transformations = totalTransformations;
        uptime = block.timestamp - deploymentTime;
        
        uint256 totalRep = 0;
        for (uint256 i = 0; i < registeredSources.length; i++) {
            totalRep += dataSources[registeredSources[i]].reputation;
        }
        
        avgReputation = sources > 0 ? totalRep / sources : 0;
    }
    
    /**
     * @dev Get task details
     */
    function getTaskDetails(bytes32 taskId) external view returns (
        bytes32 queryHash,
        address requester,
        uint256 reward,
        TaskStatus status,
        uint256 timestamp,
        uint256 submissionCount
    ) {
        QueryTask storage task = queryTasks[taskId];
        return (
            task.queryHash,
            task.requester,
            task.reward,
            task.status,
            task.timestamp,
            task.resultHashes.length
        );
    }
    
    /**
     * @dev Claim pending rewards
     */
    function claimRewards() external {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards to claim");
        
        pendingRewards[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
    
    // ==================== Helper Functions ====================
    
    /**
     * @dev Register core UIS schema
     */
    function _registerCoreSchema() internal {
        bytes32 uisId = keccak256("UIS:1.0");
        TransformationRule storage uis = transformationRules[uisId];
        uis.fromSchema = "UIS";
        uis.toSchema = "UIS";
        uis.confidence = 100;
        uis.ruleHash = uisId;
        uis.bidirectional = true;
    }
    
    /**
     * @dev Check if source is registered
     */
    function isSourceRegistered(address source) external view returns (bool) {
        return dataSources[source].owner != address(0);
    }
    
    /**
     * @dev Get registered sources count
     */
    function getSourceCount() external view returns (uint256) {
        return registeredSources.length;
    }
    
    /**
     * @dev Get active tasks count
     */
    function getActiveTaskCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < activeTasks.length; i++) {
            if (queryTasks[activeTasks[i]].status == TaskStatus.Pending) {
                count++;
            }
        }
        return count;
    }
    
    /**
     * @dev Emergency pause (owner only)
     */
    function emergencyPause() external {
        require(msg.sender == owner, "Only owner");
        // Implementation for emergency pause
    }
}