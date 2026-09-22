// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title FixedPointMath
 * @dev Shared fixed-point (1e18-precision) math helpers, referenced by
 * ConfidenceScoreCalculator and others in PacechainChannel2.sol but never
 * defined anywhere in the project. Reconstructed here purely from how its
 * functions are actually called there.
 *
 * multiplyFixedPoint / addFixedPoint / exponentialDecay are NOT guesses —
 * they're the exact same math SpeculativeTransactionHandler (also in
 * PacechainChannel2.sol) already defines inline as its own private copies.
 * This library just exposes the same operations to code that references
 * `FixedPointMath` directly instead of redefining it locally.
 *
 * exponentialGrowth is the one placeholder here: nothing in the files I've
 * seen defines it anywhere. I wrote it as the natural "growth" counterpart
 * to exponentialDecay's Taylor-series pattern (same terms, all added
 * instead of alternating add/subtract) — it compiles and is monotonically
 * increasing in x, but its exact curve is not derived from your code.
 * Nothing you've shown me reads its output for anything other than as an
 * increasing scaling factor, so this won't break wiring — just revisit the
 * formula if the precise growth curve ever matters.
 */
library FixedPointMath {
    uint256 internal constant PRECISION = 1e18;

    function multiplyFixedPoint(uint256 a, uint256 b) internal pure returns (uint256) {
        return (a * b) / PRECISION;
    }

    function addFixedPoint(uint256 a, uint256 b) internal pure returns (uint256) {
        return a + b;
    }

    /// Same 5-term Taylor-style approximation already used inline in
    /// SpeculativeTransactionHandler.exponentialDecay in PacechainChannel2.sol.
    function exponentialDecay(uint256 x) internal pure returns (uint256) {
        uint256 result = PRECISION;
        uint256 term = PRECISION;

        for (uint256 i = 1; i <= 5; i++) {
            term = multiplyFixedPoint(term, x) / i;
            if (i % 2 == 1) {
                result = result > term ? result - term : 0;
            } else {
                result = addFixedPoint(result, term);
            }
        }

        return result;
    }

    /// Placeholder growth curve — see the note above. Not derived from any
    /// existing code; only guaranteed to be increasing in x.
    function exponentialGrowth(uint256 x) internal pure returns (uint256) {
        uint256 result = PRECISION;
        uint256 term = PRECISION;

        for (uint256 i = 1; i <= 5; i++) {
            term = multiplyFixedPoint(term, x) / i;
            result = addFixedPoint(result, term);
        }

        return result;
    }
}
