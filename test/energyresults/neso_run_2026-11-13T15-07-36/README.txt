NESO real-data validation run  2026-11-13T15:07:36.206Z  (live)

run_summary.json         parameters, SHA-256 of every input CSV, result of each step
run.log                  full console output
contracts_used.json      Sepolia addresses and the oracle ABI/parameters used
neso_replay_<day>.json   24 hourly readings of real GB frequency sent to GridStabilityOracle
neso_replay_<day>.csv    the same as a table (tx hash, block, gas, on-chain score)
fig_neso_context.*       real GB demand, day-ahead price and DFS events vs the tau(t) schedule
neso_context_stats.json  numbers behind that figure
onchain_validation_results.json   only if --with-contracts was used

Caveats (state these wherever the results are used):
- The frequency series is a historical replay of NESO data through an off-chain adapter, not a live feed.
- GB runs at 50 Hz; readings are mapped to the oracle's 60 Hz nominal by preserving the deviation.
- Per hour, the second with the largest deviation from 50 Hz is used. Voltage is held at 120 V nominal.
- The demand/price/DFS figure is descriptive (design check). It does not test load shifting.
