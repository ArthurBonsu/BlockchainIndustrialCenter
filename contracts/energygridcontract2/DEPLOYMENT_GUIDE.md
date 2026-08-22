# Deployment Guide — Fixed Contracts

## What changed and why
See the `@dev` comment block at the top of each contract for the specific
diff and reasoning. Summary:

| Contract | Change | Why |
|---|---|---|
| `GridStabilityOracle.sol` | Nominal 60Hz/120V (was 50Hz/230V); G(t) normalizes deviation against a realistic tolerance band instead of full nominal | Original formula meant no real-world grid reading could ever cross G_THRESHOLD=0.85 — confirmed even 47.5Hz/207V (beyond real relay-trip range) only gave G=0.93 |
| `EnergyTokenVault.sol` | Added `approveSpender()` and `authorizedCallers`/`onlyAuthorized` (replacing `onlyOwner` on `updateReserves`) | No `approve()` existed anywhere — every `transferFrom` pulling tokens out of the Vault would revert. `onlyOwner` also can't authorize two different AMMs at once |
| `GridResponsiveAMM.sol` | Added missing `vault.updateReserves()` call after swap | Reserves went stale after the first real swap ever executed |
| `TimeWeightedAMM.sol` | No logic change | Redeployed only because its `vault` reference is `immutable` and must point at the new Vault |

## Required deployment order

1. Deploy `EnergyTokenVault` (same constructor args as before: `_tokenRE`, `_tokenNRE` — reuse your **existing** `EnergyToken` RE/NRE addresses, no need to redeploy those).
2. Deploy `GridStabilityOracle` (no constructor args, same as before).
3. Deploy `TimeWeightedAMM`, passing the **new** Vault address.
4. Deploy `GridResponsiveAMM`, passing the **new** Vault address and **new** Oracle address.

## Required post-deployment calls (easy to miss — nothing works without these)

Call these from the Vault owner's account, in this order:

```
vault.setAuthorizedCaller(timeWeightedAMM.address, true)
vault.setAuthorizedCaller(gridResponsiveAMM.address, true)
vault.approveSpender(timeWeightedAMM.address, <large RE amount>, <large NRE amount>)
vault.approveSpender(gridResponsiveAMM.address, <large RE amount>, <large NRE amount>)
```

Without the `setAuthorizedCaller` calls, `updateReserves()` will revert for
both AMMs (reserves will go stale exactly like before). Without the
`approveSpender` calls, every swap will still revert on `transferFrom` —
this is the fix for the bug that most likely caused both of your logged
live-validation failures. A safe default for the approved amounts is
`type(uint256).max`, unless you specifically want to cap exposure.

5. Call `vault.addLiquidity(...)` as before to seed the pool (same as your
   original deployment sequence — reserveRE/reserveNRE start at 0 in the
   new Vault, this isn't automatic).

## After this

Update the contract addresses in your test scripts
(`fullgridtest.js`, `gridstabilitytest.js`, etc. — or better, in a single
shared config file if you don't already have one) to the four new
addresses. `EnergyToken` (RE) and `EnergyToken` (NRE) addresses are
unchanged.

## Verifying the fix worked

After deployment + the post-deploy calls above, a quick sanity check from
your test script:

```js
await gridOracle.updateCondition(59000, 120000); // 59Hz, nominal voltage
const score = await gridOracle.getStabilityScore();
// should now be ~0.70, correctly below G_THRESHOLD=0.85
const stressed = await gridOracle.isGridStressed();
// should now be true
```

Under the original deployed contract, this same call would have returned
G≈0.995 and `isGridStressed()=false` — confirm you see the new, corrected
behavior before running a full experiment.
