// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GridStabilityOracle
 * @notice Provides real-time grid stability data
 */
contract GridStabilityOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    struct GridCondition {
        uint256 frequency;
        uint256 voltage;
        uint256 timestamp;
        uint256 stabilityScore;
    }
    
    uint256 public constant NOMINAL_FREQUENCY = 50000;  // 50 Hz
    uint256 public constant NOMINAL_VOLTAGE = 230000;   // 230V
    uint256 public constant PRECISION = 1e18;
    
    uint256 public constant ALPHA_F = 6e17;  // 0.6
    uint256 public constant ALPHA_V = 4e17;  // 0.4
    
    uint256 public constant G_THRESHOLD = 85e16;  // 0.85
    
    GridCondition private currentCondition;
    
    mapping(uint256 => GridCondition) public historicalConditions;
    uint256 public conditionCount;
    
    event ConditionUpdated(
        uint256 frequency,
        uint256 voltage,
        uint256 stabilityScore,
        uint256 timestamp
    );
    event GridStressDetected(uint256 stabilityScore, uint256 timestamp);
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        
        currentCondition = GridCondition({
            frequency: NOMINAL_FREQUENCY,
            voltage: NOMINAL_VOLTAGE,
            timestamp: block.timestamp,
            stabilityScore: PRECISION
        });
    }
    
    function updateCondition(uint256 frequency, uint256 voltage) 
        external 
        onlyRole(ORACLE_ROLE) 
    {
        require(frequency > 0 && voltage > 0, "Invalid readings");
        
        uint256 stabilityScore = _calculateStabilityScore(frequency, voltage);
        
        currentCondition = GridCondition({
            frequency: frequency,
            voltage: voltage,
            timestamp: block.timestamp,
            stabilityScore: stabilityScore
        });
        
        historicalConditions[conditionCount] = currentCondition;
        conditionCount++;
        
        emit ConditionUpdated(frequency, voltage, stabilityScore, block.timestamp);
        
        if (stabilityScore < G_THRESHOLD) {
            emit GridStressDetected(stabilityScore, block.timestamp);
        }
    }
    
    function _calculateStabilityScore(uint256 frequency, uint256 voltage) 
        internal 
        pure 
        returns (uint256 stabilityScore) 
    {
        uint256 freqDeviation;
        if (frequency > NOMINAL_FREQUENCY) {
            freqDeviation = frequency - NOMINAL_FREQUENCY;
        } else {
            freqDeviation = NOMINAL_FREQUENCY - frequency;
        }
        uint256 freqComponent = PRECISION - (freqDeviation * PRECISION) / NOMINAL_FREQUENCY;
        
        uint256 voltDeviation;
        if (voltage > NOMINAL_VOLTAGE) {
            voltDeviation = voltage - NOMINAL_VOLTAGE;
        } else {
            voltDeviation = NOMINAL_VOLTAGE - voltage;
        }
        uint256 voltComponent = PRECISION - (voltDeviation * PRECISION) / NOMINAL_VOLTAGE;
        
        stabilityScore = ((ALPHA_F * freqComponent) + (ALPHA_V * voltComponent)) / PRECISION;
        
        if (stabilityScore > PRECISION) {
            stabilityScore = PRECISION;
        }
    }
    
    function getLatestCondition() 
        external 
        view 
        returns (GridCondition memory) 
    {
        return currentCondition;
    }
    
    function getStabilityScore() 
        external 
        view 
        returns (uint256) 
    {
        return currentCondition.stabilityScore;
    }
    
    function isGridStressed() external view returns (bool) {
        return currentCondition.stabilityScore < G_THRESHOLD;
    }
    
    function getHistoricalCondition(uint256 index) 
        external 
        view 
        returns (GridCondition memory) 
    {
        require(index < conditionCount, "Invalid index");
        return historicalConditions[index];
    }
    
    function calculateStabilityScore(uint256 frequency, uint256 voltage) 
        external 
        pure 
        returns (uint256) 
    {
        return _calculateStabilityScore(frequency, voltage);
    }
}