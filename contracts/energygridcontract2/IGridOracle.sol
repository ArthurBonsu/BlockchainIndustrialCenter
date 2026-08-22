// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IGridOracle {
    struct GridCondition {
        uint256 frequency;      // Grid frequency in millihertz
        uint256 voltage;        // Voltage in millivolts
        uint256 timestamp;      // When data was recorded
        uint256 stabilityScore; // G(t) score with 1e18 precision
    }
    
    function getLatestCondition() external view returns (GridCondition memory);
    function updateCondition(uint256 frequency, uint256 voltage) external;
    function getStabilityScore() external view returns (uint256);
}