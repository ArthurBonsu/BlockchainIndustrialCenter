

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./EnergyMath.sol";

/**
 * @title EnergyTokenVault
 * @notice Manages token reserves for energy AMM
 * @dev Implements constant product function with reserve tracking
 */
contract EnergyTokenVault is Ownable, ReentrancyGuard {
    using EnergyMath for uint256;
    
    IERC20 public immutable tokenRE;
    IERC20 public immutable tokenNRE;
    
    uint256 public reserveRE;
    uint256 public reserveNRE;
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    
    uint256 private k;
    
    event ReservesUpdated(uint256 reserveRE, uint256 reserveNRE, uint256 k);
    event LiquidityAdded(address indexed provider, uint256 amountRE, uint256 amountNRE);
    event LiquidityRemoved(address indexed provider, uint256 amountRE, uint256 amountNRE);
    event Swap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    // FIXED: Added Ownable(msg.sender)
    constructor(address _tokenRE, address _tokenNRE) Ownable(msg.sender) {
        require(_tokenRE != address(0) && _tokenNRE != address(0), "Invalid tokens");
        tokenRE = IERC20(_tokenRE);
        tokenNRE = IERC20(_tokenNRE);
    }
    /**
     * @notice Add liquidity to the vault
     * @param amountRE Amount of RE tokens to add
     * @param amountNRE Amount of NRE tokens to add
     */
    function addLiquidity(uint256 amountRE, uint256 amountNRE) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(amountRE > 0 && amountNRE > 0, "Invalid amounts");
        
        // Transfer tokens from owner
        require(tokenRE.transferFrom(msg.sender, address(this), amountRE), "RE transfer failed");
        require(tokenNRE.transferFrom(msg.sender, address(this), amountNRE), "NRE transfer failed");
        
        // Update reserves
        reserveRE += amountRE;
        reserveNRE += amountNRE;
        
        // Update constant product
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        emit LiquidityAdded(msg.sender, amountRE, amountNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    /**
     * @notice Remove liquidity from the vault
     * @param amountRE Amount of RE tokens to remove
     * @param amountNRE Amount of NRE tokens to remove
     */
    function removeLiquidity(uint256 amountRE, uint256 amountNRE) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(amountRE > 0 && amountNRE > 0, "Invalid amounts");
        require(reserveRE >= amountRE + MINIMUM_LIQUIDITY, "Insufficient RE reserve");
        require(reserveNRE >= amountNRE + MINIMUM_LIQUIDITY, "Insufficient NRE reserve");
        
        // Update reserves
        reserveRE -= amountRE;
        reserveNRE -= amountNRE;
        
        // Update constant product
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        
        // Transfer tokens to owner
        require(tokenRE.transfer(msg.sender, amountRE), "RE transfer failed");
        require(tokenNRE.transfer(msg.sender, amountNRE), "NRE transfer failed");
        
        emit LiquidityRemoved(msg.sender, amountRE, amountNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    /**
     * @notice Get current token prices
     * @return priceRE Price of RE token in NRE with 1e18 precision
     * @return priceNRE Price of NRE token in RE with 1e18 precision
     */
    function getPrices() external view returns (uint256 priceRE, uint256 priceNRE) {
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        priceRE = EnergyMath.getPrice(reserveNRE, reserveRE);
        priceNRE = EnergyMath.getPrice(reserveRE, reserveNRE);
    }
    
    /**
     * @notice Calculate output amount for given input
     * @param amountIn Input token amount
     * @param reserveIn Reserve of input token
     * @param reserveOut Reserve of output token
     * @param fee Fee percentage (1e18 = 100%)
     * @return amountOut Output token amount
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 fee
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        
        // Calculate amount after fee
        uint256 amountInWithFee = EnergyMath.mulFixed(amountIn, 1e18 - fee);
        
        // AMM formula: amountOut = (amountIn * reserveOut) / (reserveIn + amountIn)
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1e18) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @notice Update reserves after swap (internal)
     * @param newReserveRE New RE reserve
     * @param newReserveNRE New NRE reserve
     */
    function _updateReserves(uint256 newReserveRE, uint256 newReserveNRE) internal {
        reserveRE = newReserveRE;
        reserveNRE = newReserveNRE;
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    /**
     * @notice Get constant product k
     * @return Current constant product
     */
    function getK() external view returns (uint256) {
        return k;
    }
    
    /**
     * @notice Get reserves
     * @return _reserveRE RE token reserve
     * @return _reserveNRE NRE token reserve
     */
    function getReserves() external view returns (uint256 _reserveRE, uint256 _reserveNRE) {
        _reserveRE = reserveRE;
        _reserveNRE = reserveNRE;
    }
}