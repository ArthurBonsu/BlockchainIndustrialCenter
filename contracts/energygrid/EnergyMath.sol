// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title EnergyMath
 * @notice Mathematical utilities for energy AMM calculations
 */
library EnergyMath {
    uint256 private constant PRECISION = 1e18;
    
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        
        return y;
    }
    
    function mulFixed(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / PRECISION;
    }
    
    function divFixed(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "Division by zero");
        return (a * PRECISION) / b;
    }
    
    function constantProduct(uint256 reserveA, uint256 reserveB) 
        internal 
        pure 
        returns (uint256) 
    {
        return reserveA * reserveB;
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