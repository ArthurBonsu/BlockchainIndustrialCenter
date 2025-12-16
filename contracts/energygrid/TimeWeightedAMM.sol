// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "EnergyMathTW.sol";
import "IEnergyVault.sol";

/**
 * @title TimeWeightedAMM
 * @notice AMM with time-weighted pricing for energy trading
 * @dev Implements time-weighted constant product function from IEEE TII paper
 *      Equation (4): R^t_α · R^t_β · τ(t) = k
 *      Equation (5): τ(t) varies by time period (peak/normal/off-peak)
 *      Equation (6): m^t_p = (R^t_β / R^t_α) · (1/τ(t))
 */
contract TimeWeightedAMM is Ownable, ReentrancyGuard {
    using EnergyMathTW for uint256;
    
    IEnergyVault public immutable vault;
    
    // ========================================================================
    // Constants
    // ========================================================================
    uint256 public constant PRECISION = 1e18;
    
    // Time weights - Equation (5)
    uint256 public tauPeak = 135e16;      // 1.35 (35% premium during peak)
    uint256 public tauOffPeak = 75e16;    // 0.75 (25% discount during off-peak)
    uint256 public tauNormal = 1e18;      // 1.0 (neutral baseline)
    
    // Time periods (in hours, 24-hour format)
    uint256 public constant PEAK_START = 17;    // 5 PM
    uint256 public constant PEAK_END = 21;      // 9 PM
    uint256 public constant OFFPEAK_START = 23; // 11 PM
    uint256 public constant OFFPEAK_END = 6;    // 6 AM
    
    uint256 public baseFee = 3e15;  // 0.3% base trading fee
    
    // ========================================================================
    // State Variables - Statistics
    // ========================================================================
    uint256 public totalSwapsRE;
    uint256 public totalSwapsNRE;
    uint256 public totalVolumeRE;
    uint256 public totalVolumeNRE;
    
    // ========================================================================
    // Events
    // ========================================================================
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
    
    // ========================================================================
    // Constructor
    // ========================================================================
    constructor(address _vault) Ownable(msg.sender) {
        require(_vault != address(0), "Invalid vault address");
        vault = IEnergyVault(_vault);
    }
    
    // ========================================================================
    // View Functions - Time Weight Logic
    // ========================================================================
    
    /**
     * @notice Get current time weight τ(t) based on time of day
     * @dev Implements Equation (5) from paper
     * @return tau Current time weight value
     */
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
    
    /**
     * @notice Get current period name for display
     * @return period String describing current period ("peak", "normal", or "offpeak")
     */
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
    
    /**
     * @notice Get time-weighted prices for RE and NRE tokens
     * @dev Implements Equation (6): m^t_p = (R^t_β / R^t_α) · (1/τ(t))
     * @return priceRE Price of RE token in terms of NRE
     * @return priceNRE Price of NRE token in terms of RE
     * @return tau Current time weight
     */
    function getTimeWeightedPrices() 
        public 
        view 
        returns (uint256 priceRE, uint256 priceNRE, uint256 tau) 
    {
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        
        tau = getCurrentTimeWeight();
        
        // Calculate base prices
        uint256 basePriceRE = EnergyMathTW.getPrice(reserveNRE, reserveRE);
        uint256 basePriceNRE = EnergyMathTW.getPrice(reserveRE, reserveNRE);
        
        // Apply time weight adjustment - Equation (6)
        priceRE = EnergyMathTW.divFixed(basePriceRE, tau);
        priceNRE = EnergyMathTW.divFixed(basePriceNRE, tau);
    }
    
    /**
     * @notice Calculate output amount for a given input (preview function)
     * @param amountIn Amount of input tokens
     * @param isREtoNRE True if swapping RE to NRE, false otherwise
     * @return amountOut Amount of output tokens
     * @return effectiveFee Fee applied to transaction
     */
    function getAmountOut(uint256 amountIn, bool isREtoNRE) 
        public 
        view 
        returns (uint256 amountOut, uint256 effectiveFee) 
    {
        require(amountIn > 0, "Invalid input amount");
        
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        
        uint256 tau = getCurrentTimeWeight();
        
        // Apply time weight to reserves - Equation (4)
        uint256 reserveIn = isREtoNRE ? reserveRE : reserveNRE;
        uint256 reserveOut = isREtoNRE ? reserveNRE : reserveRE;
        
        uint256 adjustedReserveIn = EnergyMathTW.mulFixed(reserveIn, tau);
        uint256 adjustedReserveOut = EnergyMathTW.divFixed(reserveOut, tau);
        
        effectiveFee = baseFee;
        amountOut = vault.getAmountOut(amountIn, adjustedReserveIn, adjustedReserveOut, effectiveFee);
    }
    
    // ========================================================================
    // State-Changing Functions - Trading
    // ========================================================================
    
    /**
     * @notice Execute a time-weighted token swap
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum acceptable output amount (slippage protection)
     * @param isREtoNRE True if swapping RE to NRE, false otherwise
     * @return amountOut Actual amount of output tokens received
     */
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        bool isREtoNRE
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        
        uint256 tau = getCurrentTimeWeight();
        
        // Calculate output amount with time weight applied
        uint256 effectiveFee;
        (amountOut, effectiveFee) = getAmountOut(amountIn, isREtoNRE);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        // Get token references
        IERC20 tokenIn = isREtoNRE ? vault.tokenRE() : vault.tokenNRE();
        IERC20 tokenOut = isREtoNRE ? vault.tokenNRE() : vault.tokenRE();
        
        // Transfer tokens in from user to vault
        require(
            tokenIn.transferFrom(msg.sender, address(vault), amountIn),
            "Transfer in failed"
        );
        
        // Calculate new reserves
        uint256 newReserveIn = (isREtoNRE ? reserveRE : reserveNRE) + amountIn;
        uint256 newReserveOut = (isREtoNRE ? reserveNRE : reserveRE) - amountOut;
        
        // Transfer tokens out from vault to user
        require(
            tokenOut.transferFrom(address(vault), msg.sender, amountOut),
            "Transfer out failed"
        );
        
        // Update vault reserves
        if (isREtoNRE) {
            vault.updateReserves(newReserveIn, newReserveOut);
            totalSwapsRE++;
            totalVolumeRE += amountIn;
        } else {
            vault.updateReserves(newReserveOut, newReserveIn);
            totalSwapsNRE++;
            totalVolumeNRE += amountIn;
        }
        
        // Calculate effective price for event
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
    
    // ========================================================================
    // Admin Functions
    // ========================================================================
    
    /**
     * @notice Update time weight parameters
     * @param _tauPeak New peak period weight
     * @param _tauOffPeak New off-peak period weight
     */
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
    
    /**
     * @notice Update base trading fee
     * @param _baseFee New base fee (must be <= 1%)
     */
    function updateBaseFee(uint256 _baseFee) external onlyOwner {
        require(_baseFee <= 1e16, "Fee too high (max 1%)");
        baseFee = _baseFee;
    }
    
    // ========================================================================
    // Statistics Functions
    // ========================================================================
    
    /**
     * @notice Get trading statistics
     * @return _totalSwapsRE Total number of RE→NRE swaps
     * @return _totalSwapsNRE Total number of NRE→RE swaps
     * @return _totalVolumeRE Total volume of RE tokens traded
     * @return _totalVolumeNRE Total volume of NRE tokens traded
     */
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
}




