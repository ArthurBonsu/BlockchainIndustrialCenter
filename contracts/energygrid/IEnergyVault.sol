// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IEnergyVault
 * @notice Interface for the Energy Token Vault
 */
interface IEnergyVault {
    function tokenRE() external view returns (IERC20);
    function tokenNRE() external view returns (IERC20);
    function getReserves() external view returns (uint256 reserveRE, uint256 reserveNRE);
    function getAmountOut(
        uint256 amountIn, 
        uint256 reserveIn, 
        uint256 reserveOut, 
        uint256 fee
    ) external pure returns (uint256);
    function updateReserves(uint256 newReserveRE, uint256 newReserveNRE) external;
}
