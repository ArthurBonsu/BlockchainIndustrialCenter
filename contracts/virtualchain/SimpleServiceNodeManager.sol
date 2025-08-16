// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleServiceNodeManager
 * @dev Simplified implementation of service nodes for cross-chain industrial networks
 * Demonstrates core concepts from DVRC research with easy deployment
 */
contract SimpleServiceNodeManager {
    
    // Industry types matching the research
    enum IndustryType { GENERIC, ENERGY, FINANCIAL, EDUCATION }
    enum NodeStatus { ACTIVE, INACTIVE, SUSPENDED }
    enum TransactionStatus { PENDING, PROCESSING, COMPLETED, FAILED }
    
    // Service Node structure
    struct ServiceNode {
        address nodeAddress;
        IndustryType industry;
        NodeStatus status;
        uint256 stake;
        uint256 transactionsProcessed;
        uint256 reputation; // 0-100 scale
        string endpoint;
        uint256 registrationTime;
    }
    
    // Cross-chain transaction structure
    struct CrossChainRequest {
        uint256 requestId;
        address requester;
        IndustryType targetIndustry;
        string sourceChain;
        string destinationChain;
        bytes32 dataHash;
        TransactionStatus status;
        address assignedNode;
        uint256 timestamp;
        uint256 processingFee;
    }
    
    // Industry protocol information
    struct IndustryProtocol {
        string protocolName;
        uint256 minStakeRequired;
        uint256 processingFee;
        bool isActive;
    }
    
    // State variables
    address public owner;
    uint256 public nodeCounter;
    uint256 public requestCounter;
    uint256 public totalStaked;
    
    // Mappings
    mapping(uint256 => ServiceNode) public serviceNodes;
    mapping(address => uint256) public nodeAddressToId;
    mapping(uint256 => CrossChainRequest) public crossChainRequests;
    mapping(IndustryType => IndustryProtocol) public industryProtocols;
    mapping(IndustryType => uint256[]) public industryNodeIds;
    
    // Events
    event ServiceNodeRegistered(uint256 indexed nodeId, address indexed nodeAddress, IndustryType industry);
    event CrossChainRequestCreated(uint256 indexed requestId, IndustryType industry, address requester);
    event TransactionAssigned(uint256 indexed requestId, address indexed nodeAddress);
    event TransactionCompleted(uint256 indexed requestId, bool success);
    event NodeReputationUpdated(uint256 indexed nodeId, uint256 newReputation);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyActiveNode(uint256 nodeId) {
        require(serviceNodes[nodeId].nodeAddress == msg.sender, "Not your node");
        require(serviceNodes[nodeId].status == NodeStatus.ACTIVE, "Node not active");
        _;
    }
    
    modifier validIndustry(IndustryType industry) {
        require(industry <= IndustryType.EDUCATION, "Invalid industry");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        _initializeProtocols();
    }
    
    /**
     * @dev Initialize industry protocols with default values
     */
    function _initializeProtocols() internal {
        industryProtocols[IndustryType.GENERIC] = IndustryProtocol({
            protocolName: "Generic Cross-Chain Protocol (GCCP)",
            minStakeRequired: 0.1 ether,
            processingFee: 0.01 ether,
            isActive: true
        });
        
        industryProtocols[IndustryType.ENERGY] = IndustryProtocol({
            protocolName: "EnergyChain Data Protocol (EDXP)",
            minStakeRequired: 0.2 ether,
            processingFee: 0.02 ether,
            isActive: true
        });
        
        industryProtocols[IndustryType.FINANCIAL] = IndustryProtocol({
            protocolName: "Finchain Settlement Protocol (FSCP)",
            minStakeRequired: 0.3 ether,
            processingFee: 0.03 ether,
            isActive: true
        });
        
        industryProtocols[IndustryType.EDUCATION] = IndustryProtocol({
            protocolName: "EduChain Credential Protocol (ECRP)",
            minStakeRequired: 0.15 ether,
            processingFee: 0.015 ether,
            isActive: true
        });
    }
    
    /**
     * @dev Register a new service node for specific industry
     */
    function registerServiceNode(
        IndustryType industry,
        string memory endpoint
    ) external payable validIndustry(industry) {
        require(msg.value >= industryProtocols[industry].minStakeRequired, "Insufficient stake");
        require(nodeAddressToId[msg.sender] == 0, "Already registered");
        require(bytes(endpoint).length > 0, "Endpoint required");
        
        nodeCounter++;
        
        serviceNodes[nodeCounter] = ServiceNode({
            nodeAddress: msg.sender,
            industry: industry,
            status: NodeStatus.ACTIVE,
            stake: msg.value,
            transactionsProcessed: 0,
            reputation: 100, // Start with perfect reputation
            endpoint: endpoint,
            registrationTime: block.timestamp
        });
        
        nodeAddressToId[msg.sender] = nodeCounter;
        industryNodeIds[industry].push(nodeCounter);
        totalStaked += msg.value;
        
        emit ServiceNodeRegistered(nodeCounter, msg.sender, industry);
    }
    
    /**
     * @dev Create a cross-chain transaction request
     */
    function createCrossChainRequest(
        IndustryType targetIndustry,
        string memory sourceChain,
        string memory destinationChain,
        bytes32 dataHash
    ) external payable validIndustry(targetIndustry) {
        require(msg.value >= industryProtocols[targetIndustry].processingFee, "Insufficient fee");
        require(bytes(sourceChain).length > 0, "Source chain required");
        require(bytes(destinationChain).length > 0, "Destination chain required");
        require(dataHash != bytes32(0), "Data hash required");
        
        requestCounter++;
        
        crossChainRequests[requestCounter] = CrossChainRequest({
            requestId: requestCounter,
            requester: msg.sender,
            targetIndustry: targetIndustry,
            sourceChain: sourceChain,
            destinationChain: destinationChain,
            dataHash: dataHash,
            status: TransactionStatus.PENDING,
            assignedNode: address(0),
            timestamp: block.timestamp,
            processingFee: msg.value
        });
        
        emit CrossChainRequestCreated(requestCounter, targetIndustry, msg.sender);
        
        // Auto-assign to available node
        _assignToNode(requestCounter);
    }
    
    /**
     * @dev Assign request to available service node (round-robin with reputation)
     */
    function _assignToNode(uint256 requestId) internal {
        CrossChainRequest storage request = crossChainRequests[requestId];
        uint256[] memory availableNodes = industryNodeIds[request.targetIndustry];
        
        if (availableNodes.length == 0) {
            return; // No nodes available
        }
        
        // Find best available node (highest reputation, active status)
        uint256 bestNodeId = 0;
        uint256 bestReputation = 0;
        
        for (uint i = 0; i < availableNodes.length; i++) {
            uint256 nodeId = availableNodes[i];
            ServiceNode storage node = serviceNodes[nodeId];
            
            if (node.status == NodeStatus.ACTIVE && node.reputation > bestReputation) {
                bestNodeId = nodeId;
                bestReputation = node.reputation;
            }
        }
        
        if (bestNodeId > 0) {
            request.assignedNode = serviceNodes[bestNodeId].nodeAddress;
            request.status = TransactionStatus.PROCESSING;
            emit TransactionAssigned(requestId, request.assignedNode);
        }
    }
    
    /**
     * @dev Complete transaction processing (only assigned node)
     */
    function completeTransaction(
        uint256 requestId,
        bool success,
        string memory processingDetails
    ) external {
        CrossChainRequest storage request = crossChainRequests[requestId];
        require(request.assignedNode == msg.sender, "Not assigned to you");
        require(request.status == TransactionStatus.PROCESSING, "Invalid status");
        
        uint256 nodeId = nodeAddressToId[msg.sender];
        ServiceNode storage node = serviceNodes[nodeId];
        
        // Update transaction status
        request.status = success ? TransactionStatus.COMPLETED : TransactionStatus.FAILED;
        
        // Update node metrics
        node.transactionsProcessed++;
        
        // Update reputation based on success
        if (success) {
            if (node.reputation < 100) {
                node.reputation += 1;
            }
        } else {
            if (node.reputation > 10) {
                node.reputation -= 5;
            }
        }
        
        // Pay the node
        if (success) {
            payable(msg.sender).transfer(request.processingFee);
        }
        
        emit TransactionCompleted(requestId, success);
        emit NodeReputationUpdated(nodeId, node.reputation);
    }
    
    /**
     * @dev Add more stake to existing node
     */
    function addStake() external payable {
        uint256 nodeId = nodeAddressToId[msg.sender];
        require(nodeId > 0, "Not registered");
        require(msg.value > 0, "Must send ETH");
        
        serviceNodes[nodeId].stake += msg.value;
        totalStaked += msg.value;
    }
    
    /**
     * @dev Get system statistics
     */
    function getSystemStats() external view returns (
        uint256 totalNodes,
        uint256 totalRequests,
        uint256 totalStakedAmount,
        uint256 completedTransactions,
        uint256 pendingTransactions
    ) {
        totalNodes = nodeCounter;
        totalRequests = requestCounter;
        totalStakedAmount = totalStaked;
        
        // Count completed and pending transactions
        for (uint i = 1; i <= requestCounter; i++) {
            if (crossChainRequests[i].status == TransactionStatus.COMPLETED) {
                completedTransactions++;
            } else if (crossChainRequests[i].status == TransactionStatus.PENDING || 
                      crossChainRequests[i].status == TransactionStatus.PROCESSING) {
                pendingTransactions++;
            }
        }
    }
    
    /**
     * @dev Get nodes for specific industry
     */
    function getIndustryNodes(IndustryType industry) external view returns (uint256[] memory) {
        return industryNodeIds[industry];
    }
    
    /**
     * @dev Get node details
     */
    function getNodeDetails(uint256 nodeId) external view returns (
        address nodeAddress,
        IndustryType industry,
        NodeStatus status,
        uint256 stake,
        uint256 reputation,
        uint256 transactionsProcessed,
        string memory endpoint
    ) {
        ServiceNode storage node = serviceNodes[nodeId];
        return (
            node.nodeAddress,
            node.industry,
            node.status,
            node.stake,
            node.reputation,
            node.transactionsProcessed,
            node.endpoint
        );
    }
    
    /**
     * @dev Get request details
     */
    function getRequestDetails(uint256 requestId) external view returns (
        address requester,
        IndustryType targetIndustry,
        string memory sourceChain,
        string memory destinationChain,
        TransactionStatus status,
        address assignedNode,
        uint256 processingFee
    ) {
        CrossChainRequest storage request = crossChainRequests[requestId];
        return (
            request.requester,
            request.targetIndustry,
            request.sourceChain,
            request.destinationChain,
            request.status,
            request.assignedNode,
            request.processingFee
        );
    }
    
    /**
     * @dev Get industry protocol info
     */
    function getIndustryProtocol(IndustryType industry) external view returns (
        string memory protocolName,
        uint256 minStakeRequired,
        uint256 processingFee,
        bool isActive
    ) {
        IndustryProtocol storage protocol = industryProtocols[industry];
        return (
            protocol.protocolName,
            protocol.minStakeRequired,
            protocol.processingFee,
            protocol.isActive
        );
    }
    
    /**
     * @dev Emergency functions (owner only)
     */
    function pauseNode(uint256 nodeId) external onlyOwner {
        serviceNodes[nodeId].status = NodeStatus.SUSPENDED;
    }
    
    function unpauseNode(uint256 nodeId) external onlyOwner {
        serviceNodes[nodeId].status = NodeStatus.ACTIVE;
    }
    
    function withdrawFunds(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(amount);
    }
    
    // Fallback functions
    receive() external payable {}
    fallback() external payable {}
}