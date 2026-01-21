// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EnergyMathTW
 * @notice Fixed-point math library for time-weighted AMM calculations
 */
library EnergyMathTW {
    uint256 private constant PRECISION = 1e18;
    
    function mulFixed(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / PRECISION;
    }
    
    function divFixed(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "Division by zero");
        return (a * PRECISION) / b;
    }
    
    function getPrice(uint256 reserveOut, uint256 reserveIn) 
        internal 
        pure 
        returns (uint256) 
    {
        require(reserveIn > 0, "Invalid reserve");
        return divFixed(reserveOut, reserveIn);
    }
}
