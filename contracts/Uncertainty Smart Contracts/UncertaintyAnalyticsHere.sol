// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title UncertaintyBase
 * @notice Base contract with shared components
 */
contract UncertaintyBase {
    address public owner;
    bool private locked;
    
    enum Status { Pending, Processing, Completed, Failed }
    
    uint256 public constant MAX_PROCESSING_TIME = 1 days;
    uint256 public constant BASE_COST = 0.001 ether;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier noReentrant() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }
    
    constructor() {
        owner = msg.sender;
        locked = false;
    }
    
    receive() external payable {}
    
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
}

/**
 * @title CostAnalytics
 * @notice Handles cost tracking and analytics - STANDALONE VERSION
 */
contract CostAnalytics {
    address public owner;
    
    uint256 public dataHoldingCost;
    uint256 public unavailabilityCost;
    uint256 public disruptionLevel;
    uint256 public escalationLevel;
    
    // Constants
    uint256 public constant MAX_PROCESSING_TIME = 1 days;
    uint256 public constant BASE_COST = 0.001 ether;
    
    event CostRecorded(uint256 indexed requestId, uint256 cost, string costType);
    
    constructor() {
        owner = msg.sender;
        dataHoldingCost = 0;
        unavailabilityCost = 0;
        disruptionLevel = 0;
        escalationLevel = 0;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function calculateUnavailabilityCost(uint256 _processingTime) external {
        // Remove onlyOwner to allow public calls
        if (_processingTime > MAX_PROCESSING_TIME) {
            uint256 penalty = (_processingTime - MAX_PROCESSING_TIME) * BASE_COST / 86400;
            unavailabilityCost += penalty;
            emit CostRecorded(0, penalty, "Unavailability");
        }
    }
    
    function updateDataHoldingCost(uint256 _cost) external onlyOwner {
        dataHoldingCost += _cost;
        emit CostRecorded(0, _cost, "DataHolding");
    }
    
    function updateDisruptionLevel(uint256 _level) external onlyOwner {
        disruptionLevel = _level;
    }
    
    function updateEscalationLevel(uint256 _level) external onlyOwner {
        escalationLevel = _level;
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
    
    receive() external payable {}
}

/**
 * @title RequestManager
 * @notice Handles request management - COMPATIBLE WITH ANY ANALYTICS
 */
contract RequestManager {
    address public owner;
    address public analytics; // Can be any analytics contract
    
    string public constant VERSION = "1.0.0";
    
    struct Request {
        uint256 id;
        address requester;
        uint256 timestamp;
        uint256 value;
        string additionalInfo;
        bool isValid;
        bool isProcessed;
    }
    
    uint256 public requestCount;
    uint256 public totalTransactionCost;
    uint256 public failedTransactionCount;
    
    mapping(uint256 => Request) public requests;
    mapping(address => uint256) public requesterStats;
    
    event RequestSubmitted(uint256 indexed requestId, address indexed requester, uint256 value);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    constructor(address _analytics) {
        owner = msg.sender;
        analytics = _analytics;
        requestCount = 0;
        totalTransactionCost = 0;
        failedTransactionCount = 0;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function submitRequest() external payable returns (uint256) {
        require(msg.value > 0, "Must send some ETH");
        
        requestCount += 1;
        
        requests[requestCount] = Request({
            id: requestCount,
            requester: msg.sender,
            timestamp: block.timestamp,
            value: msg.value,
            additionalInfo: "",
            isValid: true,
            isProcessed: false
        });
        
        totalTransactionCost += msg.value;
        requesterStats[msg.sender] += 1;
        
        emit RequestSubmitted(requestCount, msg.sender, msg.value);
        return requestCount;
    }
    
    function submitRequestWithInfo(string calldata _additionalInfo) external payable returns (uint256) {
        require(msg.value > 0, "Must send some ETH");
        
        requestCount += 1;
        
        requests[requestCount] = Request({
            id: requestCount,
            requester: msg.sender,
            timestamp: block.timestamp,
            value: msg.value,
            additionalInfo: _additionalInfo,
            isValid: true,
            isProcessed: false
        });
        
        totalTransactionCost += msg.value;
        requesterStats[msg.sender] += 1;
        
        emit RequestSubmitted(requestCount, msg.sender, msg.value);
        return requestCount;
    }
    
    function getAnalyticsMetrics() external view returns (
        uint256 avgProcessingTime,
        uint256 successRate,
        uint256 totalCost,
        uint256 disruptionCount
    ) {
        // Default values that don't depend on analytics contract
        avgProcessingTime = 1800; // 30 minutes default
        
        if (requestCount > 0) {
            successRate = ((requestCount - failedTransactionCount) * 100) / requestCount;
        } else {
            successRate = 100;
        }
        
        totalCost = totalTransactionCost;
        disruptionCount = failedTransactionCount;
        
        return (avgProcessingTime, successRate, totalCost, disruptionCount);
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
    
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FundsWithdrawn(owner, balance);
    }
    
    receive() external payable {}
}

/**
 * @title ResponseManager
 * @notice Handles response management - COMPATIBLE WITH ANY ANALYTICS
 */
contract ResponseManager {
    address public owner;
    address public analytics; // Can be any analytics contract
    
    string public constant VERSION = "1.0.0";
    
    struct Response {
        uint256 requestId;
        address responder;
        uint256 timestamp;
        uint256 processingTime;
        bool isValid;
    }
    
    uint256 public responseCount;
    mapping(uint256 => Response) public responses;
    mapping(uint256 => bool) public processedRequests;
    mapping(address => uint256) public responderCount;
    
    event ResponseSubmitted(uint256 indexed requestId, address indexed responder);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    
    constructor(address _analytics) {
        owner = msg.sender;
        analytics = _analytics;
        responseCount = 0;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    function submitResponse(uint256 _requestId) external {
        require(_requestId > 0, "Invalid request ID");
        require(!processedRequests[_requestId], "Request already processed");
        
        responseCount += 1;
        processedRequests[_requestId] = true;
        
        responses[_requestId] = Response({
            requestId: _requestId,
            responder: msg.sender,
            timestamp: block.timestamp,
            processingTime: 0, // Could calculate if we had request timestamp
            isValid: true
        });
        
        responderCount[msg.sender] += 1;
        
        emit ResponseSubmitted(_requestId, msg.sender);
    }
    
    function submitResponseWithCalculation(uint256 _requestId) external {
        require(_requestId > 0, "Invalid request ID");
        require(!processedRequests[_requestId], "Request already processed");
        
        responseCount += 1;
        processedRequests[_requestId] = true;
        
        // Try to call analytics contract if it exists
        if (analytics != address(0)) {
            try CostAnalytics(analytics).calculateUnavailabilityCost(1800) {
                // Analytics call succeeded
            } catch {
                // Analytics call failed, continue anyway
            }
        }
        
        responses[_requestId] = Response({
            requestId: _requestId,
            responder: msg.sender,
            timestamp: block.timestamp,
            processingTime: 1800, // Default 30 minutes
            isValid: true
        });
        
        responderCount[msg.sender] += 1;
        
        emit ResponseSubmitted(_requestId, msg.sender);
    }
    
    function getResponderCount(address _responder) external view returns (uint256 count) {
        return responderCount[_responder];
    }
    
    function getAnalyticsMetrics() external view returns (
        uint256 avgProcessingTime,
        uint256 successRate,
        uint256 totalCost,
        uint256 disruptionCount
    ) {
        // Default values
        avgProcessingTime = 1800; // 30 minutes
        successRate = 95; // 95% default
        totalCost = 0;
        disruptionCount = 0;
        
        return (avgProcessingTime, successRate, totalCost, disruptionCount);
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
    
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
        
        emit FundsWithdrawn(owner, balance);
    }
    
    receive() external payable {}
}

/**
 * @title UncertaintyAnalytics
 * @notice Complete system that can work with existing contracts
 */
contract UncertaintyAnalytics {
    address public owner;
    
    // These can be set to existing contract addresses
    address public costAnalytics;
    address public requestManager;
    address public responseManager;
    
    // Or deploy new ones
    CostAnalytics public newCostAnalytics;
    RequestManager public newRequestManager;
    ResponseManager public newResponseManager;
    
    bool public useExistingContracts;
    
    event ContractsLinked(address costAnalytics, address requestManager, address responseManager);
    
    constructor() {
        owner = msg.sender;
        useExistingContracts = false;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    /**
     * @notice Link to existing deployed contracts
     */
    function linkExistingContracts(
        address _costAnalytics,
        address _requestManager,
        address _responseManager
    ) external onlyOwner {
        costAnalytics = _costAnalytics;
        requestManager = _requestManager;
        responseManager = _responseManager;
        useExistingContracts = true;
        
        emit ContractsLinked(_costAnalytics, _requestManager, _responseManager);
    }
    
    /**
     * @notice Deploy new contracts if needed
     */
    function deployNewContracts() external onlyOwner {
        newCostAnalytics = new CostAnalytics();
        newRequestManager = new RequestManager(address(newCostAnalytics));
        newResponseManager = new ResponseManager(address(newCostAnalytics));
        useExistingContracts = false;
    }
    
    /**
     * @notice Get metrics from appropriate contracts
     */
    function getMetrics() external view returns (
        uint256 avgProcessingTime,
        uint256 successRate,
        uint256 totalCost,
        uint256 disruptionCount
    ) {
        if (useExistingContracts && requestManager != address(0)) {
            return RequestManager(requestManager).getAnalyticsMetrics();
        } else if (address(newRequestManager) != address(0)) {
            return newRequestManager.getAnalyticsMetrics();
        } else {
            return (1800, 95, 0, 0); // Default values
        }
    }
    
    /**
     * @notice Forward request submission to appropriate contract
     */
    function submitRequest() external payable returns (uint256) {
        if (useExistingContracts && requestManager != address(0)) {
            return RequestManager(requestManager).submitRequest{value: msg.value}();
        } else if (address(newRequestManager) != address(0)) {
            return newRequestManager.submitRequest{value: msg.value}();
        } else {
            revert("No request manager available");
        }
    }
    
    /**
     * @notice Forward response submission to appropriate contract
     */
    function submitResponse(uint256 _requestId) external {
        if (useExistingContracts && responseManager != address(0)) {
            ResponseManager(responseManager).submitResponse(_requestId);
        } else if (address(newResponseManager) != address(0)) {
            newResponseManager.submitResponse(_requestId);
        } else {
            revert("No response manager available");
        }
    }
    
    /**
     * @notice Forward cost analytics to appropriate contract
     */
    function calculateUnavailabilityCost(uint256 _processingTime) external {
        if (useExistingContracts && costAnalytics != address(0)) {
            CostAnalytics(costAnalytics).calculateUnavailabilityCost(_processingTime);
        } else if (address(newCostAnalytics) != address(0)) {
            newCostAnalytics.calculateUnavailabilityCost(_processingTime);
        } else {
            revert("No cost analytics available");
        }
    }
    
    function transferOwnership(address _newOwner) external onlyOwner {
        require(_newOwner != address(0), "Invalid address");
        owner = _newOwner;
    }
    
    receive() external payable {}
}