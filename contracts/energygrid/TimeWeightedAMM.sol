// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnergyMath - Inline
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

/**
 * @title IEnergyVault - Inline interface
 */
interface IEnergyVault {
    function tokenRE() external view returns (IERC20);
    function tokenNRE() external view returns (IERC20);
    function getReserves() external view returns (uint256, uint256);
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 fee) external pure returns (uint256);
    function updateReserves(uint256 newReserveRE, uint256 newReserveNRE) external;
}

/**
 * @title TimeWeightedAMM
 * @notice AMM with time-weighted pricing for energy trading
 */
contract TimeWeightedAMM is Ownable, ReentrancyGuard {
    using EnergyMathTW for uint256;
    
    IEnergyVault public immutable vault;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public tauPeak = 135e16;      // 1.35
    uint256 public tauOffPeak = 75e16;    // 0.75
    uint256 public tauNormal = 1e18;      // 1.0
    
    uint256 public constant PEAK_START = 17;
    uint256 public constant PEAK_END = 21;
    uint256 public constant OFFPEAK_START = 23;
    uint256 public constant OFFPEAK_END = 6;
    
    uint256 public baseFee = 3e15;  // 0.3%
    
    uint256 public totalSwapsRE;
    uint256 public totalSwapsNRE;
    uint256 public totalVolumeRE;
    uint256 public totalVolumeNRE;
    
    event TimeWeightUpdated(uint256 tau, string period);
    event SwapExecuted(
        address indexed user,
        bool isREtoNRE,
        uint256 amountIn,
        uint256 amountOut,
        uint256 tau,
        uint256 effectivePrice,
        uint256 timestamp
    );
    event PriceUpdated(uint256 priceRE, uint256 priceNRE, uint256 tau);
    
    // FIXED: Added Ownable(msg.sender)
    constructor(address _vault) Ownable(msg.sender) {
        require(_vault != address(0), "Invalid vault");
        vault = IEnergyVault(_vault);
    }
    
    
    function getCurrentTimeWeight() public view returns (uint256 tau) {
        uint256 currentHour = (block.timestamp / 3600) % 24;
        
        if (currentHour >= PEAK_START && currentHour <= PEAK_END) {
            tau = tauPeak;
        } else if (currentHour >= OFFPEAK_START || currentHour <= OFFPEAK_END) {
            tau = tauOffPeak;
        } else {
            tau = tauNormal;
        }
    }
    
    function getTimeWeightedPrices() 
        public 
        view 
        returns (uint256 priceRE, uint256 priceNRE, uint256 tau) 
    {
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        
        tau = getCurrentTimeWeight();
        
        uint256 basePriceRE = EnergyMathTW.getPrice(reserveNRE, reserveRE);
        uint256 basePriceNRE = EnergyMathTW.getPrice(reserveRE, reserveNRE);
        
        priceRE = EnergyMathTW.divFixed(basePriceRE, tau);
        priceNRE = EnergyMathTW.divFixed(basePriceNRE, tau);
    }
    
    function getAmountOut(uint256 amountIn, bool isREtoNRE) 
        public 
        view 
        returns (uint256 amountOut, uint256 effectiveFee) 
    {
        require(amountIn > 0, "Invalid input amount");
        
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        
        uint256 tau = getCurrentTimeWeight();
        
        uint256 reserveIn = isREtoNRE ? reserveRE : reserveNRE;
        uint256 reserveOut = isREtoNRE ? reserveNRE : reserveRE;
        
        uint256 adjustedReserveIn = EnergyMathTW.mulFixed(reserveIn, tau);
        uint256 adjustedReserveOut = EnergyMathTW.divFixed(reserveOut, tau);
        
        effectiveFee = baseFee;
        amountOut = vault.getAmountOut(amountIn, adjustedReserveIn, adjustedReserveOut, effectiveFee);
    }
    
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        bool isREtoNRE
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        
        uint256 tau = getCurrentTimeWeight();
        
        // FIXED: Separate variable declaration
        uint256 effectiveFee;
        (amountOut, effectiveFee) = getAmountOut(amountIn, isREtoNRE);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        IERC20 tokenIn = isREtoNRE ? vault.tokenRE() : vault.tokenNRE();
        IERC20 tokenOut = isREtoNRE ? vault.tokenNRE() : vault.tokenRE();
        
        require(
            tokenIn.transferFrom(msg.sender, address(vault), amountIn),
            "Transfer in failed"
        );
        
        uint256 newReserveIn = (isREtoNRE ? reserveRE : reserveNRE) + amountIn;
        uint256 newReserveOut = (isREtoNRE ? reserveNRE : reserveRE) - amountOut;
        
        require(
            tokenOut.transferFrom(address(vault), msg.sender, amountOut),
            "Transfer out failed"
        );
        
        if (isREtoNRE) {
            vault.updateReserves(newReserveIn, newReserveOut);
            totalSwapsRE++;
            totalVolumeRE += amountIn;
        } else {
            vault.updateReserves(newReserveOut, newReserveIn);
            totalSwapsNRE++;
            totalVolumeNRE += amountIn;
        }
        
        uint256 effectivePrice = EnergyMathTW.divFixed(amountOut * PRECISION, amountIn);
        
        emit SwapExecuted(
            msg.sender,
            isREtoNRE,
            amountIn,
            amountOut,
            tau,
            effectivePrice,
            block.timestamp
        );
    }
    
    function updateTimeWeights(uint256 _tauPeak, uint256 _tauOffPeak) 
        external 
        onlyOwner 
    {
        require(_tauPeak > 0 && _tauOffPeak > 0, "Invalid weights");
        require(_tauPeak != _tauOffPeak, "Weights must differ");
        
        tauPeak = _tauPeak;
        tauOffPeak = _tauOffPeak;
        
        emit TimeWeightUpdated(_tauPeak, "peak");
        emit TimeWeightUpdated(_tauOffPeak, "offpeak");
    }
    
    function updateBaseFee(uint256 _baseFee) external onlyOwner {
        require(_baseFee <= 1e16, "Fee too high");
        baseFee = _baseFee;
    }
    
    function getStatistics() 
        external 
        view 
        returns (
            uint256 _totalSwapsRE,
            uint256 _totalSwapsNRE,
            uint256 _totalVolumeRE,
            uint256 _totalVolumeNRE
        ) 
    {
        return (totalSwapsRE, totalSwapsNRE, totalVolumeRE, totalVolumeNRE);
    }
    
    function getCurrentPeriod() external view returns (string memory period) {
        uint256 currentHour = (block.timestamp / 3600) % 24;
        
        if (currentHour >= PEAK_START && currentHour <= PEAK_END) {
            period = "peak";
        } else if (currentHour >= OFFPEAK_START || currentHour <= OFFPEAK_END) {
            period = "offpeak";
        } else {
            period = "normal";
        }
    }
}