// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IEnergyToken {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    // Energy-specific metadata
    function energyType() external view returns (string memory);
    function isRenewable() external view returns (bool);
}