// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Remix-compatible imports
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnergyMath - Inline for Remix
 */
library EnergyMath {
    uint256 private constant PRECISION = 1e18;
    
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

/**
 * @title EnergyTokenVault
 * @notice Manages token reserves for energy AMM
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
    
    constructor(address _tokenRE, address _tokenNRE) Ownable(msg.sender) {
        require(_tokenRE != address(0) && _tokenNRE != address(0), "Invalid tokens");
        tokenRE = IERC20(_tokenRE);
        tokenNRE = IERC20(_tokenNRE);
    }
    
    function addLiquidity(uint256 amountRE, uint256 amountNRE) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(amountRE > 0 && amountNRE > 0, "Invalid amounts");
        
        require(tokenRE.transferFrom(msg.sender, address(this), amountRE), "RE transfer failed");
        require(tokenNRE.transferFrom(msg.sender, address(this), amountNRE), "NRE transfer failed");
        
        reserveRE += amountRE;
        reserveNRE += amountNRE;
        
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        
        emit LiquidityAdded(msg.sender, amountRE, amountNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    function removeLiquidity(uint256 amountRE, uint256 amountNRE) 
        external 
        onlyOwner 
        nonReentrant 
    {
        require(amountRE > 0 && amountNRE > 0, "Invalid amounts");
        require(reserveRE >= amountRE + MINIMUM_LIQUIDITY, "Insufficient RE reserve");
        require(reserveNRE >= amountNRE + MINIMUM_LIQUIDITY, "Insufficient NRE reserve");
        
        reserveRE -= amountRE;
        reserveNRE -= amountNRE;
        
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        
        require(tokenRE.transfer(msg.sender, amountRE), "RE transfer failed");
        require(tokenNRE.transfer(msg.sender, amountNRE), "NRE transfer failed");
        
        emit LiquidityRemoved(msg.sender, amountRE, amountNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    function getPrices() external view returns (uint256 priceRE, uint256 priceNRE) {
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        priceRE = EnergyMath.getPrice(reserveNRE, reserveRE);
        priceNRE = EnergyMath.getPrice(reserveRE, reserveNRE);
    }
    
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 fee
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");
        
        uint256 amountInWithFee = EnergyMath.mulFixed(amountIn, 1e18 - fee);
        
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1e18) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    function updateReserves(uint256 newReserveRE, uint256 newReserveNRE) external onlyOwner {
        reserveRE = newReserveRE;
        reserveNRE = newReserveNRE;
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    function getK() external view returns (uint256) {
        return k;
    }
    
    function getReserves() external view returns (uint256 _reserveRE, uint256 _reserveNRE) {
        _reserveRE = reserveRE;
        _reserveNRE = reserveNRE;
    }
}