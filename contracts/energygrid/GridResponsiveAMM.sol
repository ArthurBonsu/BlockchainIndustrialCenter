// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title EnergyMathGR - Inline
 */
library EnergyMathGR {
    uint256 private constant PRECISION = 1e18;
    
    function mulFixed(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / PRECISION;
    }
    
    function divFixed(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "Division by zero");
        return (a * PRECISION) / b;
    }
}

/**
 * @title IEnergyVault - Inline interface
 */
interface IEnergyVaultGR {
    function tokenRE() external view returns (IERC20);
    function tokenNRE() external view returns (IERC20);
    function getReserves() external view returns (uint256, uint256);
    function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut, uint256 fee) external pure returns (uint256);
    function updateReserves(uint256 newReserveRE, uint256 newReserveNRE) external;
}

/**
 * @title IGridOracle - Inline interface
 */
interface IGridOracleGR {
    function getStabilityScore() external view returns (uint256);
}

/**
 * @title GridResponsiveAMM
 * @notice AMM with grid stability-responsive fees
 */
contract GridResponsiveAMM is Ownable, ReentrancyGuard {
    using EnergyMathGR for uint256;
    
    IEnergyVaultGR public immutable vault;
    IGridOracleGR public immutable gridOracle;
    
    uint256 public constant PRECISION = 1e18;
    uint256 public baseFee = 3e15;  // 0.3%
    
    uint256 public thetaNRE = 15e17;  // 1.5
    uint256 public thetaRE = 5e17;    // 0.5
    uint256 public constant G_THRESHOLD = 85e16;  // 0.85
    
    address public stabilityRewardVault;
    uint256 public accumulatedStabilityFees;
    
    mapping(address => uint256) public gridStabilityTokens;
    mapping(address => uint256) public energyDeferredDuringStress;
    uint256 public totalGSTIssued;
    
    uint256 public totalSwapsRE;
    uint256 public totalSwapsNRE;
    uint256 public swapsDuringStress;
    uint256 public totalStressEvents;
    
    event SwapExecuted(
        address indexed user,
        bool isREtoNRE,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeMultiplier,
        uint256 gridScore,
        uint256 feePaid,
        uint256 timestamp
    );
    event GridStressResponse(
        address indexed user,
        uint256 energyDeferred,
        uint256 gstAwarded,
        uint256 timestamp
    );
    event StabilityFeesDistributed(
        uint256 totalFees,
        uint256 recipientCount,
        uint256 timestamp
    );
    event ParametersUpdated(string param, uint256 value);
    
    // ✅ FIXED: Added Ownable(msg.sender) to pass initial owner to base constructor
    constructor(address _vault, address _gridOracle) Ownable(msg.sender) {
        require(_vault != address(0) && _gridOracle != address(0), "Invalid addresses");
        vault = IEnergyVaultGR(_vault);
        gridOracle = IGridOracleGR(_gridOracle);
        stabilityRewardVault = address(this);
    }
    
    function getGridFeeMultiplier(bool isNRE) 
        public 
        view 
        returns (uint256 feeMultiplier, uint256 gridScore) 
    {
        gridScore = gridOracle.getStabilityScore();
        
        if (gridScore >= G_THRESHOLD) {
            feeMultiplier = PRECISION;
        } else {
            if (isNRE) {
                uint256 penalty = EnergyMathGR.mulFixed(
                    thetaNRE,
                    PRECISION - gridScore
                );
                feeMultiplier = PRECISION + penalty;
            } else {
                uint256 reward = EnergyMathGR.mulFixed(
                    thetaRE,
                    PRECISION - gridScore
                );
                feeMultiplier = PRECISION - reward;
            }
        }
    }
    
    function calculateEffectiveFee(uint256 amountIn, bool isNRE) 
        public 
        view 
        returns (uint256 effectiveFee, uint256 feeMultiplier) 
    {
        uint256 gridScore;
        (feeMultiplier, gridScore) = getGridFeeMultiplier(isNRE);
        
        uint256 adjustedFee = EnergyMathGR.mulFixed(baseFee, feeMultiplier);
        effectiveFee = EnergyMathGR.mulFixed(adjustedFee, amountIn);
    }
    
    function getAmountOut(uint256 amountIn, bool isREtoNRE) 
        public 
        view 
        returns (uint256 amountOut, uint256 effectiveFee) 
    {
        require(amountIn > 0, "Invalid input amount");
        
        (uint256 reserveRE, uint256 reserveNRE) = vault.getReserves();
        require(reserveRE > 0 && reserveNRE > 0, "No liquidity");
        
        bool isNRE = !isREtoNRE;
        
        uint256 feeMultiplier;
        uint256 gridScore;
        (feeMultiplier, gridScore) = getGridFeeMultiplier(isNRE);
        
        uint256 adjustedFee = EnergyMathGR.mulFixed(baseFee, feeMultiplier);
        
        uint256 reserveIn = isREtoNRE ? reserveRE : reserveNRE;
        uint256 reserveOut = isREtoNRE ? reserveNRE : reserveRE;
        
        amountOut = vault.getAmountOut(amountIn, reserveIn, reserveOut, adjustedFee);
        effectiveFee = EnergyMathGR.mulFixed(adjustedFee, amountIn);
    }
    
    function swap(
        uint256 amountIn,
        uint256 minAmountOut,
        bool isREtoNRE
    ) external nonReentrant returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        
        uint256 gridScore = gridOracle.getStabilityScore();
        bool isGridStressed = gridScore < G_THRESHOLD;
        
        bool isNRE = !isREtoNRE;
        
        uint256 feeMultiplier;
        uint256 tempGridScore;
        (feeMultiplier, tempGridScore) = getGridFeeMultiplier(isNRE);
        
        uint256 feePaid;
        (amountOut, feePaid) = getAmountOut(amountIn, isREtoNRE);
        require(amountOut >= minAmountOut, "Slippage exceeded");
        
        IERC20 tokenIn = isREtoNRE ? vault.tokenRE() : vault.tokenNRE();
        IERC20 tokenOut = isREtoNRE ? vault.tokenNRE() : vault.tokenRE();
        
        require(
            tokenIn.transferFrom(msg.sender, address(vault), amountIn),
            "Transfer in failed"
        );
        
        require(
            tokenOut.transferFrom(address(vault), msg.sender, amountOut),
            "Transfer out failed"
        );
        
        if (isGridStressed) {
            swapsDuringStress++;
            
            if (!isNRE && feePaid < EnergyMathGR.mulFixed(baseFee, amountIn)) {
                _issueGridStabilityTokens(msg.sender, amountIn, gridScore);
            }
            
            if (isNRE && feePaid > EnergyMathGR.mulFixed(baseFee, amountIn)) {
                uint256 extraFee = feePaid - EnergyMathGR.mulFixed(baseFee, amountIn);
                accumulatedStabilityFees += extraFee;
            }
        }
        
        if (isREtoNRE) {
            totalSwapsRE++;
        } else {
            totalSwapsNRE++;
        }
        
        emit SwapExecuted(
            msg.sender,
            isREtoNRE,
            amountIn,
            amountOut,
            feeMultiplier,
            gridScore,
            feePaid,
            block.timestamp
        );
        
        return amountOut;
    }
    
    function _issueGridStabilityTokens(
        address user,
        uint256 energyAmount,
        uint256 gridScore
    ) internal {
        uint256 gammaReward = 1e17;  // 0.1
        uint256 gstAmount = EnergyMathGR.mulFixed(
            EnergyMathGR.mulFixed(gammaReward, energyAmount),
            PRECISION - gridScore
        );
        
        gridStabilityTokens[user] += gstAmount;
        energyDeferredDuringStress[user] += energyAmount;
        totalGSTIssued += gstAmount;
        
        emit GridStressResponse(user, energyAmount, gstAmount, block.timestamp);
    }
    
    function distributeStabilityFees() external onlyOwner {
        require(accumulatedStabilityFees > 0, "No fees to distribute");
        require(totalGSTIssued > 0, "No GST holders");
        
        uint256 feesDistributed = accumulatedStabilityFees;
        accumulatedStabilityFees = 0;
        
        emit StabilityFeesDistributed(feesDistributed, totalGSTIssued, block.timestamp);
    }
    
    function updateGridParameters(uint256 _thetaNRE, uint256 _thetaRE) 
        external 
        onlyOwner 
    {
        require(_thetaNRE > PRECISION && _thetaRE < PRECISION, "Invalid parameters");
        
        thetaNRE = _thetaNRE;
        thetaRE = _thetaRE;
        
        emit ParametersUpdated("thetaNRE", _thetaNRE);
        emit ParametersUpdated("thetaRE", _thetaRE);
    }
    
    function getUserGST(address user) 
        external 
        view 
        returns (uint256 gstBalance, uint256 energyDeferred) 
    {
        gstBalance = gridStabilityTokens[user];
        energyDeferred = energyDeferredDuringStress[user];
    }
    
    function getStatistics() 
        external 
        view 
        returns (
            uint256 _totalSwapsRE,
            uint256 _totalSwapsNRE,
            uint256 _swapsDuringStress,
            uint256 _accumulatedFees,
            uint256 _totalGST
        ) 
    {
        return (
            totalSwapsRE,
            totalSwapsNRE,
            swapsDuringStress,
            accumulatedStabilityFees,
            totalGSTIssued
        );
    }
    
    function isGridStressed() 
        external 
        view 
        returns (bool isStressed, uint256 gridScore) 
    {
        gridScore = gridOracle.getStabilityScore();
        isStressed = gridScore < G_THRESHOLD;
    }
}