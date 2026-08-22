// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GridStabilityOracle
 * @notice Provides real-time grid stability data
 *
 * @dev CHANGES FROM ORIGINAL DEPLOYED VERSION (see DATA_INTEGRITY_MEMO.md):
 *   1. NOMINAL_FREQUENCY/NOMINAL_VOLTAGE corrected to 60 Hz / 120 V to match
 *      what the manuscript actually states (the deployed version used
 *      50 Hz / 230 V -- European convention -- silently contradicting the
 *      paper's own text).
 *   2. G(t) calculation now normalizes deviation against a MAX_*_DEVIATION
 *      tolerance band instead of the full nominal value. The original
 *      formula normalized by nominal (e.g. deviation/50000), which meant
 *      no physically realistic frequency/voltage reading could ever push
 *      the score below G_THRESHOLD=0.85 -- confirmed: even a 47.5 Hz/207V
 *      reading (beyond real protective-relay trip ranges) only produced
 *      G=0.93. The new MAX_FREQ_DEVIATION (2 Hz) and MAX_VOLT_DEVIATION_PCT
 *      (13.33%) are derived FROM the manuscript's own stated trigger
 *      language -- "frequency deviations exceeding +/-0.5 Hz or voltage
 *      deviations exceeding +/-5%" -- solved so that boundary sits exactly
 *      at G(t)=0.85 when only one of the two deviates (the other at
 *      nominal). This is a genuine formula change, not a rediscovery of
 *      hidden intent -- documented here for that reason.
 *   3. calculateStabilityScore is unchanged in signature/visibility; only
 *      the internal normalization changed.
 *   All other structure, access control, and function signatures are
 *   unchanged from the original.
 */
contract GridStabilityOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    
    struct GridCondition {
        uint256 frequency;
        uint256 voltage;
        uint256 timestamp;
        uint256 stabilityScore;
    }
    
    uint256 public constant NOMINAL_FREQUENCY = 60000;   // 60 Hz (was 50000 -- corrected to match manuscript)
    uint256 public constant NOMINAL_VOLTAGE = 120000;    // 120 V (was 230000 -- corrected to match manuscript)
    uint256 public constant PRECISION = 1e18;
    
    uint256 public constant ALPHA_F = 6e17;  // 0.6 -- unchanged, matches manuscript
    uint256 public constant ALPHA_V = 4e17;  // 0.4 -- unchanged, matches manuscript
    
    uint256 public constant G_THRESHOLD = 85e16;  // 0.85 -- unchanged, matches manuscript

    // NEW: tolerance bands the deviation is normalized against, instead of
    // the full nominal value. Derived from the manuscript's own stated
    // trigger conditions (see contract-level dev comment above).
    uint256 public constant MAX_FREQ_DEVIATION = 2000;        // 2 Hz, scaled by 1000 to match frequency's 1000x scaling
    uint256 public constant MAX_VOLT_DEVIATION_PCT = 1333e14; // 13.33%, i.e. 0.1333 * PRECISION
    
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
        // CHANGED: normalize against MAX_FREQ_DEVIATION (a realistic
        // tolerance band), not the full nominal frequency. Clamped at 0
        // (i.e. deviations beyond the band contribute nothing further,
        // rather than underflowing).
        uint256 freqComponent;
        if (freqDeviation >= MAX_FREQ_DEVIATION) {
            freqComponent = 0;
        } else {
            freqComponent = PRECISION - (freqDeviation * PRECISION) / MAX_FREQ_DEVIATION;
        }
        
        uint256 voltDeviation;
        if (voltage > NOMINAL_VOLTAGE) {
            voltDeviation = voltage - NOMINAL_VOLTAGE;
        } else {
            voltDeviation = NOMINAL_VOLTAGE - voltage;
        }
        // CHANGED: normalize against MAX_VOLT_DEVIATION_PCT of nominal
        // voltage, not the full nominal voltage.
        uint256 maxVoltDeviation = (NOMINAL_VOLTAGE * MAX_VOLT_DEVIATION_PCT) / PRECISION;
        uint256 voltComponent;
        if (voltDeviation >= maxVoltDeviation) {
            voltComponent = 0;
        } else {
            voltComponent = PRECISION - (voltDeviation * PRECISION) / maxVoltDeviation;
        }
        
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
