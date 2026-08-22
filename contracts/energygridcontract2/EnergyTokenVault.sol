// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

// Remix-compatible imports
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

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
 *
 * @dev CHANGES FROM ORIGINAL DEPLOYED VERSION (see DATA_INTEGRITY_MEMO.md):
 *   1. NEW: authorizedCallers mapping + onlyAuthorized modifier.
 *      updateReserves was `onlyOwner`, but TWO AMM contracts
 *      (TimeWeightedAMM and GridResponsiveAMM) both need to call it, and
 *      standard Ownable only supports one owner at a time -- structurally
 *      impossible for both to be authorized simultaneously under the
 *      original design. onlyAuthorized replaces onlyOwner for
 *      updateReserves, with the owner able to authorize multiple AMMs.
 *   2. NEW: approveSpender(), callable by the owner, which makes the
 *      Vault itself call IERC20.approve() on behalf of each token. The
 *      original contract had NO approve() call anywhere -- meaning every
 *      `tokenOut.transferFrom(address(vault), msg.sender, amountOut)`
 *      call in BOTH AMM contracts would revert with insufficient
 *      allowance. This is almost certainly the actual cause of the
 *      "Error happened while trying to execute a function inside a smart
 *      contract" seen in both logged live-validation attempts
 *      (ieee_validation_results.json, ieee_validation_results_final.json)
 *      -- neither ever got past a real swap.
 *   All other structure and function signatures are unchanged.
 */
contract EnergyTokenVault is Ownable, ReentrancyGuard {
    using EnergyMath for uint256;
    
    IERC20 public immutable tokenRE;
    IERC20 public immutable tokenNRE;
    
    uint256 public reserveRE;
    uint256 public reserveNRE;
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    
    uint256 private k;

    // NEW: multi-caller authorization for updateReserves (see dev comment).
    mapping(address => bool) public authorizedCallers;
    
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
    event CallerAuthorized(address indexed caller, bool status); // NEW
    event SpenderApproved(address indexed spender, uint256 amountRE, uint256 amountNRE); // NEW
    
    modifier onlyAuthorized() { // NEW
        require(authorizedCallers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }
    
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
    
    function updateReserves(uint256 newReserveRE, uint256 newReserveNRE) external onlyAuthorized { // CHANGED: was onlyOwner
        reserveRE = newReserveRE;
        reserveNRE = newReserveNRE;
        k = EnergyMath.constantProduct(reserveRE, reserveNRE);
        emit ReservesUpdated(reserveRE, reserveNRE, k);
    }
    
    // NEW: owner authorizes an AMM contract to call updateReserves.
    function setAuthorizedCaller(address caller, bool status) external onlyOwner {
        require(caller != address(0), "Invalid caller");
        authorizedCallers[caller] = status;
        emit CallerAuthorized(caller, status);
    }
    
    // NEW: owner grants an AMM contract ERC20 allowance to pull tokens
    // out of the vault. Must be called once per AMM after deployment
    // (and again if allowance runs low, or use type(uint256).max).
    function approveSpender(address spender, uint256 amountRE, uint256 amountNRE) external onlyOwner {
        require(spender != address(0), "Invalid spender");
        require(tokenRE.approve(spender, amountRE), "RE approve failed");
        require(tokenNRE.approve(spender, amountNRE), "NRE approve failed");
        emit SpenderApproved(spender, amountRE, amountNRE);
    }
    
    function getK() external view returns (uint256) {
        return k;
    }
    
    function getReserves() external view returns (uint256 _reserveRE, uint256 _reserveNRE) {
        _reserveRE = reserveRE;
        _reserveNRE = reserveNRE;
    }
}
