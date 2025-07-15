// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title ClimateRegulationContract
 * @dev Complete climate regulation system with carbon trading, compliance tracking, and Nash equilibrium
 * Compatible with Truffle climate regulation experiment framework
 */
contract ClimateRegulationContract is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Events
    event CityRegistered(uint256 indexed cityId, string name, uint256 baseline);
    event IndustryRegistered(uint256 indexed industryId, uint256 indexed cityId, string name, uint256 initialEmission);
    event EmissionUpdated(uint256 indexed industryId, uint256 newEmission, uint256 timestamp);
    event CarbonCreditTraded(address indexed trader, uint256 credits, uint256 price);
    event NashEquilibriumReached(uint256 proposedPrice, uint256 credits, address proposer);
    event ComplianceUpdated(uint256 indexed industryId, uint256 complianceScore);
    event RenewalTriggered(uint256 indexed industryId, uint256 newPeriod);

    // Structs
    struct City {
        string name;
        uint256 baseline;
        uint256 registrationBlock;
        bool isRegistered;
        uint256[] industryIds;
    }

    struct Industry {
        string name;
        uint256 cityId;
        address owner;
        uint256 currentEmission;
        uint256 initialEmission;
        uint256[] emissionHistory;
        uint256[] complianceHistory;
        uint256 renewalCount;
        uint256 lastRenewalTime;
        bool isActive;
        uint256 carbonCredits;
    }

    struct TradingData {
        uint256 totalVolume;
        uint256 currentPrice;
        uint256 lastTradeTime;
        uint256 ammLiquidity;
    }

    struct NashEquilibrium {
        uint256 proposedPrice;
        uint256 credits;
        address proposer;
        uint256 timestamp;
        bool isActive;
    }

    // State variables
    mapping(uint256 => City) public cities;
    mapping(uint256 => Industry) public industries;
    mapping(address => uint256[]) public industriesByOwner;
    
    uint256 public cityCounter;
    uint256 public industryCounter;
    
    // Trading system
    TradingData public tradingData;
    mapping(address => uint256) public carbonCredits;
    uint256 public constant INITIAL_CREDIT_PRICE = 0.001 ether;
    uint256 public constant AMM_LIQUIDITY_POOL = 10000;
    
    // Nash equilibrium tracking
    NashEquilibrium[] public nashEquilibriums;
    mapping(address => bool) public hasActiveEquilibrium;
    
    // Compliance and renewal system
    uint256 public constant RENEWAL_PERIOD = 30 days;
    uint256 public constant TARGET_COMPLIANCE = 85;
    mapping(uint256 => uint256) public lastComplianceCheck;
    
    // Performance metrics
    uint256 public totalTransactions;
    uint256 public totalGasUsed;
    uint256 public systemStartTime;

    constructor() Ownable(msg.sender) {
        systemStartTime = block.timestamp;
        tradingData = TradingData({
            totalVolume: 0,
            currentPrice: INITIAL_CREDIT_PRICE,
            lastTradeTime: block.timestamp,
            ammLiquidity: AMM_LIQUIDITY_POOL
        });
    }

    /**
     * @dev Register a new city with baseline emissions
     * @param _name City name
     * @param _baseline Baseline emission level
     */
    function registerCity(string memory _name, uint256 _baseline) external onlyOwner {
        cityCounter++;
        
        cities[cityCounter] = City({
            name: _name,
            baseline: _baseline,
            registrationBlock: block.number,
            isRegistered: true,
            industryIds: new uint256[](0)
        });
        
        totalTransactions++;
        emit CityRegistered(cityCounter, _name, _baseline);
    }

    /**
     * @dev Register a new industry in a city
     * @param _cityId City ID where industry is located
     * @param _name Industry name
     * @param _initialEmission Initial emission level
     */
    function registerIndustry(
        uint256 _cityId,
        string memory _name,
        uint256 _initialEmission
    ) external {
        require(cities[_cityId].isRegistered, "City not registered");
        require(_initialEmission > 0, "Initial emission must be positive");
        
        industryCounter++;
        
        // Initialize arrays
        uint256[] memory emissionHistory = new uint256[](1);
        emissionHistory[0] = _initialEmission;
        
        uint256[] memory complianceHistory = new uint256[](1);
        complianceHistory[0] = calculateInitialCompliance(_cityId, _initialEmission);
        
        industries[industryCounter] = Industry({
            name: _name,
            cityId: _cityId,
            owner: msg.sender,
            currentEmission: _initialEmission,
            initialEmission: _initialEmission,
            emissionHistory: emissionHistory,
            complianceHistory: complianceHistory,
            renewalCount: 0,
            lastRenewalTime: block.timestamp,
            isActive: true,
            carbonCredits: 0
        });
        
        // Update city's industry list
        cities[_cityId].industryIds.push(industryCounter);
        
        // Update owner's industry list
        industriesByOwner[msg.sender].push(industryCounter);
        
        // Initial carbon credits based on performance
        uint256 initialCredits = calculateInitialCredits(_cityId, _initialEmission);
        carbonCredits[msg.sender] = carbonCredits[msg.sender].add(initialCredits);
        industries[industryCounter].carbonCredits = initialCredits;
        
        totalTransactions++;
        emit IndustryRegistered(industryCounter, _cityId, _name, _initialEmission);
    }

    /**
     * @dev Update industry emissions
     * @param _industryId Industry ID
     * @param _newEmission New emission level
     */
    function updateEmissions(uint256 _industryId, uint256 _newEmission) external {
        require(industries[_industryId].isActive, "Industry not active");
        require(industries[_industryId].owner == msg.sender, "Not industry owner");
        require(_newEmission > 0, "Emission must be positive");
        
        Industry storage industry = industries[_industryId];
        
        // Update emission data
        industry.currentEmission = _newEmission;
        industry.emissionHistory.push(_newEmission);
        
        // Calculate compliance score
        uint256 complianceScore = calculateComplianceScore(_industryId, _newEmission);
        industry.complianceHistory.push(complianceScore);
        
        // Check for renewal trigger
        if (block.timestamp >= industry.lastRenewalTime + RENEWAL_PERIOD) {
            triggerRenewal(_industryId);
        }
        
        // Award/penalize carbon credits based on performance
        updateCarbonCredits(_industryId, _newEmission);
        
        totalTransactions++;
        emit EmissionUpdated(_industryId, _newEmission, block.timestamp);
        emit ComplianceUpdated(_industryId, complianceScore);
    }

    /**
     * @dev Trade carbon credits using AMM pricing
     * @param _credits Number of credits to trade
     */
    function tradeCarbonCredits(uint256 _credits) external payable nonReentrant {
        require(_credits > 0, "Credits must be positive");
        require(carbonCredits[msg.sender] >= _credits, "Insufficient credits");
        
        uint256 price = calculateAMMPrice(_credits, true);
        require(msg.value >= price, "Insufficient payment");
        
        // Update trading data
        tradingData.totalVolume = tradingData.totalVolume.add(_credits);
        tradingData.lastTradeTime = block.timestamp;
        tradingData.currentPrice = price;
        
        // Transfer credits
        carbonCredits[msg.sender] = carbonCredits[msg.sender].sub(_credits);
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        totalTransactions++;
        emit CarbonCreditTraded(msg.sender, _credits, price);
    }

    /**
     * @dev Propose Nash equilibrium for trading
     * @param _proposedPrice Proposed equilibrium price
     * @param _credits Number of credits involved
     */
    function proposeNashEquilibrium(uint256 _proposedPrice, uint256 _credits) external {
        require(_credits > 0, "Credits must be positive");
        require(!hasActiveEquilibrium[msg.sender], "Already has active equilibrium");
        
        // Check if proposed price is within reasonable range of current market
        uint256 currentMarketPrice = calculateAMMPrice(_credits, false);
        uint256 priceDeviation = _proposedPrice > currentMarketPrice ? 
            _proposedPrice - currentMarketPrice : currentMarketPrice - _proposedPrice;
        
        // Nash equilibrium achieved if price deviation is less than 10%
        if (priceDeviation <= currentMarketPrice.div(10)) {
            nashEquilibriums.push(NashEquilibrium({
                proposedPrice: _proposedPrice,
                credits: _credits,
                proposer: msg.sender,
                timestamp: block.timestamp,
                isActive: true
            }));
            
            hasActiveEquilibrium[msg.sender] = true;
            
            totalTransactions++;
            emit NashEquilibriumReached(_proposedPrice, _credits, msg.sender);
        }
    }

    /**
     * @dev Calculate AMM price for carbon credits
     * @param _credits Number of credits
     * @param _isBuy True for buy, false for sell
     * @return price Price in wei
     */
    function calculateAMMPrice(uint256 _credits, bool _isBuy) public view returns (uint256) {
        uint256 k = tradingData.ammLiquidity * tradingData.currentPrice;
        
        if (_isBuy) {
            // Price increases with demand
            uint256 newLiquidity = tradingData.ammLiquidity - _credits;
            require(newLiquidity > 0, "Insufficient liquidity");
            return k / newLiquidity;
        } else {
            // Price decreases with supply
            uint256 newLiquidity = tradingData.ammLiquidity + _credits;
            return k / newLiquidity;
        }
    }

    /**
     * @dev Calculate compliance score for industry
     * @param _industryId Industry ID
     * @param _currentEmission Current emission level
     * @return score Compliance score (0-100)
     */
    function calculateComplianceScore(uint256 _industryId, uint256 _currentEmission) 
        public view returns (uint256) {
        Industry storage industry = industries[_industryId];
        uint256 cityBaseline = cities[industry.cityId].baseline;
        
        if (_currentEmission >= cityBaseline) {
            return 0;
        }
        
        uint256 improvement = cityBaseline - _currentEmission;
        uint256 score = improvement.mul(100).div(cityBaseline);
        
        return score > 100 ? 100 : score;
    }

    /**
     * @dev Trigger renewal process for industry
     * @param _industryId Industry ID
     */
    function triggerRenewal(uint256 _industryId) internal {
        Industry storage industry = industries[_industryId];
        
        industry.renewalCount++;
        industry.lastRenewalTime = block.timestamp;
        
        // Bonus credits for renewal
        uint256 renewalBonus = 10;
        carbonCredits[industry.owner] = carbonCredits[industry.owner].add(renewalBonus);
        industry.carbonCredits = industry.carbonCredits.add(renewalBonus);
        
        emit RenewalTriggered(_industryId, industry.renewalCount);
    }

    /**
     * @dev Update carbon credits based on emission performance
     * @param _industryId Industry ID
     * @param _newEmission New emission level
     */
    function updateCarbonCredits(uint256 _industryId, uint256 _newEmission) internal {
        Industry storage industry = industries[_industryId];
        
        if (industry.emissionHistory.length < 2) {
            return;
        }
        
        uint256 previousEmission = industry.emissionHistory[industry.emissionHistory.length - 2];
        
        if (_newEmission < previousEmission) {
            // Reward for reduction
            uint256 reduction = previousEmission - _newEmission;
            uint256 rewardCredits = reduction.div(100); // 1 credit per 100 units reduction
            
            carbonCredits[industry.owner] = carbonCredits[industry.owner].add(rewardCredits);
            industry.carbonCredits = industry.carbonCredits.add(rewardCredits);
        } else if (_newEmission > previousEmission) {
            // Penalty for increase
            uint256 increase = _newEmission - previousEmission;
            uint256 penaltyCredits = increase.div(200); // 1 credit penalty per 200 units increase
            
            if (carbonCredits[industry.owner] >= penaltyCredits) {
                carbonCredits[industry.owner] = carbonCredits[industry.owner].sub(penaltyCredits);
                industry.carbonCredits = industry.carbonCredits.sub(penaltyCredits);
            }
        }
    }

    /**
     * @dev Calculate initial compliance score
     * @param _cityId City ID
     * @param _initialEmission Initial emission level
     * @return score Initial compliance score
     */
    function calculateInitialCompliance(uint256 _cityId, uint256 _initialEmission) 
        internal view returns (uint256) {
        uint256 cityBaseline = cities[_cityId].baseline;
        
        if (_initialEmission >= cityBaseline) {
            return 0;
        }
        
        return cityBaseline.sub(_initialEmission).mul(100).div(cityBaseline);
    }

    /**
     * @dev Calculate initial carbon credits for new industry
     * @param _cityId City ID
     * @param _initialEmission Initial emission level
     * @return credits Initial carbon credits
     */
    function calculateInitialCredits(uint256 _cityId, uint256 _initialEmission) 
        internal view returns (uint256) {
        uint256 cityBaseline = cities[_cityId].baseline;
        
        if (_initialEmission >= cityBaseline) {
            return 50; // Minimum credits for participation
        }
        
        uint256 performanceRatio = cityBaseline.sub(_initialEmission).mul(100).div(cityBaseline);
        return 50 + performanceRatio; // 50-150 credits based on initial performance
    }

    // View functions for experiment analytics
    
    /**
     * @dev Get industry emission history
     * @param _industryId Industry ID
     * @return emissionHistory Array of emission values
     */
    function getIndustryEmissionHistory(uint256 _industryId) 
        external view returns (uint256[] memory) {
        return industries[_industryId].emissionHistory;
    }

    /**
     * @dev Get industry compliance history
     * @param _industryId Industry ID
     * @return complianceHistory Array of compliance scores
     */
    function getIndustryComplianceHistory(uint256 _industryId) 
        external view returns (uint256[] memory) {
        return industries[_industryId].complianceHistory;
    }

    /**
     * @dev Get city industry list
     * @param _cityId City ID
     * @return industryIds Array of industry IDs in the city
     */
    function getCityIndustries(uint256 _cityId) 
        external view returns (uint256[] memory) {
        return cities[_cityId].industryIds;
    }

    /**
     * @dev Get industries by owner
     * @param _owner Owner address
     * @return industryIds Array of industry IDs owned by address
     */
    function getIndustriesByOwner(address _owner) 
        external view returns (uint256[] memory) {
        return industriesByOwner[_owner];
    }

    /**
     * @dev Get Nash equilibrium count
     * @return count Number of Nash equilibriums reached
     */
    function getNashEquilibriumCount() external view returns (uint256) {
        return nashEquilibriums.length;
    }

    /**
     * @dev Get trading statistics
     * @return totalVolume Total trading volume
     * @return currentPrice Current market price
     * @return lastTradeTime Last trade timestamp
     */
    function getTradingStats() external view returns (uint256, uint256, uint256) {
        return (tradingData.totalVolume, tradingData.currentPrice, tradingData.lastTradeTime);
    }

    /**
     * @dev Get system performance metrics
     * @return totalTx Total transactions
     * @return startTime System start time
     * @return cityCount Number of cities
     * @return industryCount Number of industries
     */
    function getSystemMetrics() external view returns (uint256, uint256, uint256, uint256) {
        return (totalTransactions, systemStartTime, cityCounter, industryCounter);
    }

    // Admin functions

    /**
     * @dev Emergency pause for specific industry
     * @param _industryId Industry ID to pause
     */
    function pauseIndustry(uint256 _industryId) external onlyOwner {
        industries[_industryId].isActive = false;
    }

    /**
     * @dev Resume specific industry
     * @param _industryId Industry ID to resume
     */
    function resumeIndustry(uint256 _industryId) external onlyOwner {
        industries[_industryId].isActive = true;
    }

    /**
     * @dev Adjust AMM liquidity (for testing)
     * @param _newLiquidity New liquidity amount
     */
    function adjustAMMLiquidity(uint256 _newLiquidity) external onlyOwner {
        tradingData.ammLiquidity = _newLiquidity;
    }

    /**
     * @dev Withdraw contract balance (for testing)
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev Get Nash equilibrium by index
     * @param _index Index of Nash equilibrium
     * @return proposedPrice Proposed price
     * @return credits Credits involved
     * @return proposer Proposer address
     * @return timestamp Timestamp
     * @return isActive Whether equilibrium is active
     */
    function getNashEquilibrium(uint256 _index) 
        external view returns (uint256, uint256, address, uint256, bool) {
        require(_index < nashEquilibriums.length, "Index out of bounds");
        NashEquilibrium storage eq = nashEquilibriums[_index];
        return (eq.proposedPrice, eq.credits, eq.proposer, eq.timestamp, eq.isActive);
    }

    /**
     * @dev Get industry details
     * @param _industryId Industry ID
     * @return name Industry name
     * @return cityId City ID
     * @return owner Owner address
     * @return currentEmission Current emission level
     * @return carbonCredits Carbon credits owned
     * @return renewalCount Number of renewals
     * @return isActive Whether industry is active
     */
    function getIndustryDetails(uint256 _industryId) 
        external view returns (
            string memory name,
            uint256 cityId,
            address owner,
            uint256 currentEmission,
            uint256 carbonCredits,
            uint256 renewalCount,
            bool isActive
        ) {
        Industry storage industry = industries[_industryId];
        return (
            industry.name,
            industry.cityId,
            industry.owner,
            industry.currentEmission,
            industry.carbonCredits,
            industry.renewalCount,
            industry.isActive
        );
    }

    /**
     * @dev Get city details
     * @param _cityId City ID
     * @return name City name
     * @return baseline Baseline emissions
     * @return registrationBlock Registration block number
     * @return isRegistered Whether city is registered
     * @return industryCount Number of industries in city
     */
    function getCityDetails(uint256 _cityId) 
        external view returns (
            string memory name,
            uint256 baseline,
            uint256 registrationBlock,
            bool isRegistered,
            uint256 industryCount
        ) {
        City storage city = cities[_cityId];
        return (
            city.name,
            city.baseline,
            city.registrationBlock,
            city.isRegistered,
            city.industryIds.length
        );
    }

    /**
     * @dev Get current compliance score for industry
     * @param _industryId Industry ID
     * @return score Current compliance score
     */
    function getCurrentCompliance(uint256 _industryId) external view returns (uint256) {
        require(industries[_industryId].isActive, "Industry not active");
        return calculateComplianceScore(_industryId, industries[_industryId].currentEmission);
    }

    /**
     * @dev Get latest compliance score from history
     * @param _industryId Industry ID
     * @return score Latest compliance score
     */
    function getLatestComplianceScore(uint256 _industryId) external view returns (uint256) {
        uint256[] memory history = industries[_industryId].complianceHistory;
        require(history.length > 0, "No compliance history");
        return history[history.length - 1];
    }

    /**
     * @dev Get average emission for industry
     * @param _industryId Industry ID
     * @return avgEmission Average emission level
     */
    function getAverageEmission(uint256 _industryId) external view returns (uint256) {
        uint256[] memory history = industries[_industryId].emissionHistory;
        require(history.length > 0, "No emission history");
        
        uint256 total = 0;
        for (uint256 i = 0; i < history.length; i++) {
            total = total.add(history[i]);
        }
        return total.div(history.length);
    }

    /**
     * @dev Get emission trend for industry (improvement percentage)
     * @param _industryId Industry ID
     * @return trendPercentage Positive for improvement, negative for decline
     */
    function getEmissionTrend(uint256 _industryId) external view returns (int256) {
        uint256[] memory history = industries[_industryId].emissionHistory;
        require(history.length >= 2, "Insufficient history for trend");
        
        uint256 initial = history[0];
        uint256 current = history[history.length - 1];
        
        if (initial == 0) return 0;
        
        // Calculate percentage change (positive = improvement/reduction)
        int256 change = int256(initial) - int256(current);
        int256 percentage = (change * 100) / int256(initial);
        
        return percentage;
    }

    /**
     * @dev Batch update emissions for multiple industries (for simulation efficiency)
     * @param _industryIds Array of industry IDs
     * @param _emissions Array of new emission levels
     */
    function batchUpdateEmissions(uint256[] memory _industryIds, uint256[] memory _emissions) 
        external {
        require(_industryIds.length == _emissions.length, "Array length mismatch");
        require(_industryIds.length <= 50, "Too many updates at once");
        
        for (uint256 i = 0; i < _industryIds.length; i++) {
            uint256 industryId = _industryIds[i];
            uint256 newEmission = _emissions[i];
            
            // Verify ownership and validity
            require(industries[industryId].isActive, "Industry not active");
            require(industries[industryId].owner == msg.sender, "Not industry owner");
            require(newEmission > 0, "Emission must be positive");
            
            Industry storage industry = industries[industryId];
            
            // Update emission data
            industry.currentEmission = newEmission;
            industry.emissionHistory.push(newEmission);
            
            // Calculate compliance score
            uint256 complianceScore = calculateComplianceScore(industryId, newEmission);
            industry.complianceHistory.push(complianceScore);
            
            // Check for renewal trigger
            if (block.timestamp >= industry.lastRenewalTime + RENEWAL_PERIOD) {
                triggerRenewal(industryId);
            }
            
            // Award/penalize carbon credits based on performance
            updateCarbonCredits(industryId, newEmission);
            
            totalTransactions++;
            emit EmissionUpdated(industryId, newEmission, block.timestamp);
            emit ComplianceUpdated(industryId, complianceScore);
        }
    }

    /**
     * @dev Buy carbon credits from pool
     * @param _credits Number of credits to buy
     */
    function buyCarbonCredits(uint256 _credits) external payable nonReentrant {
        require(_credits > 0, "Credits must be positive");
        
        uint256 price = calculateAMMPrice(_credits, true);
        require(msg.value >= price, "Insufficient payment");
        
        // Update trading data
        tradingData.totalVolume = tradingData.totalVolume.add(_credits);
        tradingData.lastTradeTime = block.timestamp;
        tradingData.currentPrice = price;
        tradingData.ammLiquidity = tradingData.ammLiquidity.sub(_credits);
        
        // Transfer credits to buyer
        carbonCredits[msg.sender] = carbonCredits[msg.sender].add(_credits);
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        totalTransactions++;
        emit CarbonCreditTraded(msg.sender, _credits, price);
    }

    /**
     * @dev Sell carbon credits to pool
     * @param _credits Number of credits to sell
     */
    function sellCarbonCredits(uint256 _credits) external nonReentrant {
        require(_credits > 0, "Credits must be positive");
        require(carbonCredits[msg.sender] >= _credits, "Insufficient credits");
        
        uint256 price = calculateAMMPrice(_credits, false);
        require(address(this).balance >= price, "Insufficient contract balance");
        
        // Update trading data
        tradingData.totalVolume = tradingData.totalVolume.add(_credits);
        tradingData.lastTradeTime = block.timestamp;
        tradingData.currentPrice = price;
        tradingData.ammLiquidity = tradingData.ammLiquidity.add(_credits);
        
        // Transfer credits from seller
        carbonCredits[msg.sender] = carbonCredits[msg.sender].sub(_credits);
        
        // Pay seller
        payable(msg.sender).transfer(price);
        
        totalTransactions++;
        emit CarbonCreditTraded(msg.sender, _credits, price);
    }

    /**
     * @dev Get total compliance score for a city
     * @param _cityId City ID
     * @return avgCompliance Average compliance score of all industries in city
     */
    function getCityCompliance(uint256 _cityId) external view returns (uint256) {
        require(cities[_cityId].isRegistered, "City not registered");
        
        uint256[] memory industryIds = cities[_cityId].industryIds;
        if (industryIds.length == 0) return 0;
        
        uint256 totalCompliance = 0;
        uint256 activeIndustries = 0;
        
        for (uint256 i = 0; i < industryIds.length; i++) {
            if (industries[industryIds[i]].isActive) {
                totalCompliance = totalCompliance.add(
                    calculateComplianceScore(industryIds[i], industries[industryIds[i]].currentEmission)
                );
                activeIndustries++;
            }
        }
        
        return activeIndustries > 0 ? totalCompliance.div(activeIndustries) : 0;
    }

    /**
     * @dev Get city emission total
     * @param _cityId City ID
     * @return totalEmission Sum of all industry emissions in city
     */
    function getCityEmissionTotal(uint256 _cityId) external view returns (uint256) {
        require(cities[_cityId].isRegistered, "City not registered");
        
        uint256[] memory industryIds = cities[_cityId].industryIds;
        uint256 totalEmission = 0;
        
        for (uint256 i = 0; i < industryIds.length; i++) {
            if (industries[industryIds[i]].isActive) {
                totalEmission = totalEmission.add(industries[industryIds[i]].currentEmission);
            }
        }
        
        return totalEmission;
    }

    /**
     * @dev Check if renewal is due for industry
     * @param _industryId Industry ID
     * @return isDue Whether renewal is due
     * @return timeRemaining Time remaining until renewal (0 if due)
     */
    function checkRenewalStatus(uint256 _industryId) 
        external view returns (bool isDue, uint256 timeRemaining) {
        Industry storage industry = industries[_industryId];
        uint256 nextRenewal = industry.lastRenewalTime + RENEWAL_PERIOD;
        
        if (block.timestamp >= nextRenewal) {
            return (true, 0);
        } else {
            return (false, nextRenewal - block.timestamp);
        }
    }

    /**
     * @dev Manual renewal trigger (for testing purposes)
     * @param _industryId Industry ID
     */
    function manualRenewal(uint256 _industryId) external {
        require(industries[_industryId].owner == msg.sender || msg.sender == owner(), 
                "Not authorized");
        require(industries[_industryId].isActive, "Industry not active");
        
        triggerRenewal(_industryId);
        totalTransactions++;
    }

    /**
     * @dev Reset Nash equilibrium status for address (for testing)
     * @param _address Address to reset
     */
    function resetNashEquilibrium(address _address) external onlyOwner {
        hasActiveEquilibrium[_address] = false;
    }

    /**
     * @dev Emergency fund injection for testing
     */
    function emergencyFund() external payable onlyOwner {
        // Allow owner to add funds for testing trading functionality
    }

    /**
     * @dev Get detailed system statistics
     * @return totalTx Total transactions
     * @return totalCities Number of cities
     * @return totalIndustries Number of industries  
     * @return totalCreditsIssued Total carbon credits in circulation
     * @return avgCityCompliance Average compliance across all cities
     * @return systemUptime System uptime in seconds
     */
    function getDetailedSystemStats() external view returns (
        uint256 totalTx,
        uint256 totalCities,
        uint256 totalIndustries,
        uint256 totalCreditsIssued,
        uint256 avgCityCompliance,
        uint256 systemUptime
    ) {
        // Calculate total credits issued
        uint256 totalCredits = 0;
        for (uint256 i = 1; i <= industryCounter; i++) {
            if (industries[i].isActive) {
                totalCredits = totalCredits.add(industries[i].carbonCredits);
            }
        }
        
        // Calculate average city compliance
        uint256 totalCityCompliance = 0;
        uint256 activeCities = 0;
        for (uint256 i = 1; i <= cityCounter; i++) {
            if (cities[i].isRegistered && cities[i].industryIds.length > 0) {
                // Get city compliance (this would call getCityCompliance internally)
                uint256[] memory industryIds = cities[i].industryIds;
                uint256 cityCompliance = 0;
                uint256 activeIndustries = 0;
                
                for (uint256 j = 0; j < industryIds.length; j++) {
                    if (industries[industryIds[j]].isActive) {
                        cityCompliance = cityCompliance.add(
                            calculateComplianceScore(industryIds[j], industries[industryIds[j]].currentEmission)
                        );
                        activeIndustries++;
                    }
                }
                
                if (activeIndustries > 0) {
                    totalCityCompliance = totalCityCompliance.add(cityCompliance.div(activeIndustries));
                    activeCities++;
                }
            }
        }
        
        uint256 avgCompliance = activeCities > 0 ? totalCityCompliance.div(activeCities) : 0;
        uint256 uptime = block.timestamp - systemStartTime;
        
        return (
            totalTransactions,
            cityCounter,
            industryCounter,
            totalCredits,
            avgCompliance,
            uptime
        );
    }

    // Receive function for carbon credit payments
    receive() external payable {
        // Allow contract to receive ETH for carbon credit trading
    }
}