# Table 4 / Section 7.1 Data-Integrity Findings and Fix

## How to run this on your own system

Both scripts use only Node's built-in `fs`/`path` — no `npm install`
needed, no `dotenv` dependency (that was only a stub for this sandbox).

1. Copy `generate_scenarios_v2.js` and `run_paired_scenarios.js` into
   `BlockchainIndustrialPlatform/test/` (alongside `timeweight.js`,
   `fullgridtest.js`, etc.). Nothing else in `test/` is touched or
   overwritten.
2. From `BlockchainIndustrialPlatform/test/`, run:
   ```
   node run_paired_scenarios.js
   ```
3. Output appears in a new `test/results_v2/` folder:
   - `table4_replacement.json` — full numeric results
   - `table4_replacement.csv` — per-prosumer table as CSV
   - `table4_replacement.tex` — drop-in LaTeX table for the manuscript
   - `baseline_run_illustrative.json` / `treatment_run_illustrative.json`
     — one concrete paired 520-tx dataset, same shape as your original
     `synthetic_transactions_520.json`
4. The run is deterministic (seeded PRNG) — running it again reproduces
   identical numbers, on any machine. If you want different seeds or more
   of them, edit `HEADLINE_SEED` / `N_SEEDS` at the top of
   `run_paired_scenarios.js`.

## What was wrong (confirmed against your actual code and data)

1. **Empty band.** No prosumer has ε < 0.05 (`generate_synthetic_scenarios.js`
   lines 53–67: min ε is 0.10, Factory-C). The "Inflexible (<0.05)" row in
   Table 4 has no corresponding data points.

2. **Prosumers outside every band.** Office-B (ε=0.18), Household-B
   (ε=0.38), Household-C (ε=0.52) fall in the gaps between or beyond
   Table 4's bands.

3. **Section 6.3 vs 6.5 contradict each other** on the elasticity range.
   6.3 says "0.4–0.5 to below 0.05"; 6.5 says "0.10 to 0.52." The actual
   data matches 6.5 (verified: min 0.10, max 0.52 in
   `synthetic_transactions_520.json`).

4. **Weak real effect.** Correlation between a prosumer's actual elasticity
   and their actual share of peak-hour transactions in
   `synthetic_transactions_520.json` is **−0.22** (essentially the
   opposite direction of what "43.2% vs 3.2%" implies), computed directly
   from the 520-transaction dataset.

5. **No baseline run ever existed.** `generate_synthetic_scenarios.js`
   (lines 344–351) computes peak reduction against `baselinePeakShare =
   0.35` and off-peak increase against `baselineOffpeakShare = 0.25` —
   both are typed-in constants, not simulation output. Section 6.3's claim
   that "we executed parallel scenarios with baseline τ(t) = 1.0" describes
   a run that isn't in the codebase.

6. **The mechanism that would produce load-timing shift doesn't exist in
   v1.** Lines 208–223 of `generate_synthetic_scenarios.js`: the prosumer
   for each transaction slot is picked *uniformly at random*, independent
   of elasticity. Elasticity only affects `sellREProbability` — i.e.
   whether a trade (already scheduled at a random hour) is a buy or a
   sell. It never affects *whether or when* a prosumer trades. Peak/off-peak
   transaction *counts* per hour are fixed multipliers (×1.1 peak, ×1.6
   off-peak) applied identically to every prosumer regardless of ε. There
   is no code path by which "elasticity-graded peak avoidance" could show
   up in the data — confirmed empirically by finding #4 above.

7. **"43.2%" traces to an unrelated, uncalibrated formula, not Table 4's
   own methodology.** A separate snippet (lines 388–393,
   `highElasticityReduction = (1 - peakFrac/0.35) × 100`, applied to the
   pooled ε≥0.35 group) reproduces 43.17% when run against your real data
   — but this number was never exported to the JSON, never computed
   per-band, and has no defined relationship to the other seven cells in
   Table 4, which don't correspond to any computation in any script
   provided. The `.tex` source's own revision-log comment ("Why: Matches
   actual high-elasticity results (43.2% from simulation)") is consistent
   with the number having been fit to a target rather than derived from
   Table 4's stated methodology.

## What was fixed

Two structural gaps were closed in a new script
(`generate_scenarios_v2.js`, copied from your generator — **the original
files were not modified**):

- **Elasticity now genuinely drives load timing**, not just trade
  direction. Prosumer selection for each transaction slot is weighted by
  `baseLoad_i × (1 − ε_i × (τ_period − 1))`, and total transaction volume
  per hour is scaled by the population's aggregate elasticity response to
  that hour's τ. At τ=1 (baseline) this collapses to exactly the original
  uniform behavior for every prosumer — elasticity has zero effect absent
  a price signal, which is what a valid baseline requires.
- **A real baseline is logged**, not assumed. `run_paired_scenarios.js`
  runs the identical generator with τ flattened to 1.0 for every period,
  using the *same random seed* as the τ=1.35/0.75 treatment run, so the
  two runs differ only in τ (a genuine paired counterfactual) and both are
  written to disk.
- Because 520 transactions over 10 prosumers is a small, noisy sample
  (this was part of why finding #4 above is so weak), results are
  **averaged over 150 independent paired seeds** (78,000 transactions per
  arm) rather than read off a single draw.

## New results (replace Table 4 / Section 7.1 numbers with these)

System-wide, averaged over 150 paired seeds:

| | Baseline | Treatment | Change |
|---|---|---|---|
| Peak share | 15.01% | 14.00% | **−6.7%** (peak reduction) |
| Off-peak share | 39.89% | 41.02% | **+2.8%** (off-peak increase) |

Correlation between ε and per-prosumer peak reduction: **+0.74** (vs. −0.22
in the original dataset — this is what a real effect looks like).

Per-prosumer (replaces the four-band Table 4 — see `table4_replacement.tex`
for a drop-in LaTeX table, `table4_replacement.csv` for the raw numbers):

| Prosumer | ε | Peak Red. | Off-Peak Inc. |
|---|---|---|---|
| Household-C | 0.52 | 13.7% | 10.3% |
| Household-A | 0.45 | 17.4% | 15.2% |
| Household-D | 0.40 | 15.1% | 13.2% |
| Household-B | 0.38 | 12.2% | 2.6% |
| Restaurant-C | 0.22 | 14.3% | 6.8% |
| Shop-A | 0.25 | 10.1% | 1.3% |
| Factory-C | 0.10 | 6.3% | 0.5% |
| Factory-B | 0.15 | 3.8% | 1.3% |
| Office-B | 0.18 | 3.7% | 2.2% |
| Factory-A | 0.12 | 0.9% | 1.0% |

**Important honesty note:** these numbers (6.7% system-wide peak reduction,
not 32.6%; 13.7% for the most elastic entity, not 43.2%) come from a demand
model I designed for this fix — a literal implementation of the standard
elasticity definition %ΔQ = −ε × %ΔP applied to your τ values — not from
data you collected or a model you specified. It is one reasonable,
economically-grounded choice, not the only one, and the resulting
magnitudes are a direct, mechanical consequence of your actual ε range
(0.10–0.52) and actual τ deviations (+35%/−25%). If you had a different
mechanism in mind for how elasticity should govern load timing, these
numbers will change — but any correctly-specified mechanism will produce
effects of this general order (single digits to ~15–20%), not 40%+, given
these elasticity and price parameters.

## What still needs manual edits in the manuscript

- Table 4: replace with `table4_replacement.tex`.
- Section 6.3: fix elasticity range to match 6.5 (0.10–0.52), and rewrite
  the sentence claiming a baseline τ(t)=1.0 run was executed — it now
  actually has been (describe the paired-seed methodology above).
- Section 7.1 prose: replace 32.6%/53.3%/43.2%/3.2%/etc. throughout with
  the numbers above (also appears in the Discussion section around
  "Parameter Governance Models" and "Prosumer Adoption Incentives").
- Abstract and Introduction: same replacement (32.6% and 53.3% appear
  there too).
- Note the smaller effect sizes weaken (but do not eliminate) the paper's
  comparison to the 12–18% range from prior blockchain energy systems —
  6.7% no longer exceeds that range. This comparison claim needs
  reconsidering, not just renumbering.

## Files delivered

- `generate_scenarios_v2.js` — fixed generator (copy; original untouched)
- `run_paired_scenarios.js` — driver: runs paired baseline+treatment,
  averages over 150 seeds, exports everything below
- `table4_replacement.json` — full numeric results (averaged + one
  illustrative single-seed run)
- `table4_replacement.csv` — per-prosumer table as CSV
- `table4_replacement.tex` — drop-in LaTeX table
- `baseline_run_illustrative.json` / `treatment_run_illustrative.json` —
  one concrete paired 520-tx dataset (seed 20260810), same format as your
  original `synthetic_transactions_520.json`, for spot-checking
