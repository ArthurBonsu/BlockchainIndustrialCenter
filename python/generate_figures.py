"""
generate_figures.py
--------------------
Builds IEEE-quality figures (PNG + PDF, 300 dpi) from REAL data only:

  1. table4_replacement.json   - the 150-seed paired Monte Carlo simulation
                                  (load-shifting by prosumer elasticity)
  2. onchain_validation_results.json - genuine Sepolia transactions from
                                  onchain_validation.js (optional -- if this
                                  file doesn't exist yet, those figures are
                                  skipped with a clear message, not faked)
  3. grid_feeder_results.json  - the 24-hour on-chain oracle trace, with
                                  per-hour "verification" status (optional --
                                  falls back to "unconfirmed_plausible" if the
                                  field is missing, so make sure this is the
                                  ANNOTATED file, not the raw grid_feeder.js
                                  output, or every hour will show unconfirmed)

Defaults assume the BlockchainIndustrialPlatform repo layout, run from the
repo root:
    --data-dir defaults to test/energyresults  (where the three JSONs above live)
    --out-dir  defaults to figs                (matches the manuscript's
                                                 \\includegraphics{figs/...} paths)
Override either with a flag if your layout differs. The resolved paths are
printed at the start of every run so a wrong folder is obvious immediately.

No numbers in this script are invented. If a figure needs data that isn't
present, it is skipped rather than filled in with a placeholder.

Usage:
    python3 generate_figures.py                          # uses the defaults above
    python3 generate_figures.py --data-dir DIR --out-dir DIR   # override either
"""

import json
import csv
import argparse
import os
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams
from scipy import stats

# ---------------------------------------------------------------------------
# Publication-quality defaults
# ---------------------------------------------------------------------------
rcParams['font.family'] = 'serif'
rcParams['font.size'] = 10
rcParams['axes.labelsize'] = 10
rcParams['xtick.labelsize'] = 9
rcParams['ytick.labelsize'] = 9
rcParams['legend.fontsize'] = 9
rcParams['figure.dpi'] = 150
rcParams['savefig.dpi'] = 300
rcParams['savefig.bbox'] = 'tight'

TYPE_COLORS = {"residential": "#1f77b4", "commercial": "#2ca02c", "industrial": "#d62728"}


def savefig(fig, out_dir, name):
    fig.savefig(out_dir / f"{name}.png", dpi=300, bbox_inches='tight')
    fig.savefig(out_dir / f"{name}.pdf", bbox_inches='tight')
    plt.close(fig)
    print(f"  \u2713 {name}.png / {name}.pdf")


# ===========================================================================
# PART 1 -- Monte Carlo simulation figures (table4_replacement.json)
# ===========================================================================

def load_montecarlo(data_dir):
    path = data_dir / "table4_replacement.json"
    if not path.exists():
        print(f"  ! {path.name} not found -- skipping Monte Carlo figures.")
        return None
    with open(path) as f:
        return json.load(f)


def fig_per_prosumer(mc, out_dir):
    """Bar chart: peak reduction % by prosumer, sorted by elasticity."""
    rows = sorted(mc["perProsumerAveraged"], key=lambda r: -r["elasticity"])
    names = [r["name"] for r in rows]
    peak_red = [r["peakReduction_pct"] for r in rows]
    offpeak_inc = [r["offpeakIncrease_pct"] for r in rows]
    colors = [TYPE_COLORS[r["type"]] for r in rows]

    x = np.arange(len(names))
    width = 0.38

    fig, ax = plt.subplots(figsize=(8, 4.2))
    ax.bar(x - width / 2, peak_red, width, label="Peak reduction (%)",
           color=colors, alpha=0.85, edgecolor='black', linewidth=0.5)
    ax.bar(x + width / 2, offpeak_inc, width, label="Off-peak increase (%)",
           color=colors, alpha=0.45, edgecolor='black', linewidth=0.5, hatch='//')

    ax.set_xticks(x)
    ax.set_xticklabels(names, rotation=30, ha='right')
    ax.set_ylabel("Percentage change (%)", fontweight='bold')
    ax.set_title("Load-Shifting by Prosumer, Sorted by Price Elasticity\n"
                 "(150-seed paired Monte Carlo average)", fontweight='bold', pad=12)
    ax.axhline(0, color='black', linewidth=0.8)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)

    from matplotlib.patches import Patch
    type_handles = [Patch(facecolor=c, edgecolor='black', label=t.capitalize())
                     for t, c in TYPE_COLORS.items()]
    shade_handles = [Patch(facecolor='gray', alpha=0.85, edgecolor='black', label='Peak reduction'),
                      Patch(facecolor='gray', alpha=0.45, edgecolor='black', hatch='//', label='Off-peak increase')]
    leg1 = ax.legend(handles=type_handles, loc='upper right', title='Prosumer type', framealpha=0.95)
    ax.add_artist(leg1)
    ax.legend(handles=shade_handles, loc='upper center', framealpha=0.95)

    fig.tight_layout()
    savefig(fig, out_dir, "fig_per_prosumer_load_shifting")


def fig_elasticity_correlation(mc, out_dir):
    """Scatter: elasticity vs peak reduction, with fitted line and recomputed r."""
    rows = mc["perProsumerAveraged"]
    eps = np.array([r["elasticity"] for r in rows])
    red = np.array([r["peakReduction_pct"] for r in rows])
    colors = [TYPE_COLORS[r["type"]] for r in rows]

    slope, intercept, r_value, p_value, std_err = stats.linregress(eps, red)
    reported_r = mc.get("elasticityVsPeakReductionCorrelation")

    fig, ax = plt.subplots(figsize=(5.5, 4.2))
    ax.scatter(eps, red, c=colors, s=70, edgecolor='black', linewidth=0.6, zorder=3)
    xs = np.linspace(eps.min(), eps.max(), 50)
    ax.plot(xs, slope * xs + intercept, '--', color='gray', linewidth=1.5, zorder=2)

    for r in rows:
        ax.annotate(r["name"], (r["elasticity"], r["peakReduction_pct"]),
                    fontsize=6.5, xytext=(4, 3), textcoords='offset points')

    note = f"recomputed r = {r_value:.3f}"
    if reported_r is not None:
        note += f"  (reported: {reported_r:.3f})"
    ax.text(0.03, 0.95, note, transform=ax.transAxes, fontsize=8, va='top',
             bbox=dict(boxstyle='round', facecolor='white', alpha=0.85, edgecolor='gray'))

    ax.set_xlabel("Price elasticity (\u03b5)", fontweight='bold')
    ax.set_ylabel("Peak reduction (%)", fontweight='bold')
    ax.set_title("Peak-Reduction Response vs. Price Elasticity\n"
                 "(per-prosumer, 150-seed average)", fontweight='bold', pad=12)
    ax.grid(alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)

    from matplotlib.patches import Patch
    handles = [Patch(facecolor=c, edgecolor='black', label=t.capitalize()) for t, c in TYPE_COLORS.items()]
    ax.legend(handles=handles, loc='lower right', framealpha=0.95)

    fig.tight_layout()
    savefig(fig, out_dir, "fig_elasticity_correlation")
    return r_value


def fig_system_wide(mc, out_dir):
    """Grouped bar: baseline vs treatment, peak share and off-peak share."""
    sw = mc["systemWideAveraged"]
    categories = ["Peak share (%)", "Off-peak share (%)"]
    baseline = [sw["peakShare_baseline_pct"], sw["offpeakShare_baseline_pct"]]
    treatment = [sw["peakShare_treatment_pct"], sw["offpeakShare_treatment_pct"]]

    x = np.arange(len(categories))
    width = 0.32

    fig, ax = plt.subplots(figsize=(5.5, 4))
    b1 = ax.bar(x - width / 2, baseline, width, label=f"Baseline (\u03c4=1, static)",
                color='#7f7f7f', alpha=0.85, edgecolor='black', linewidth=0.5)
    b2 = ax.bar(x + width / 2, treatment, width, label=f"Time-weighted (\u03c4peak=1.35, \u03c4off=0.75)",
                color='#1f77b4', alpha=0.9, edgecolor='black', linewidth=0.5)

    for bars in (b1, b2):
        for bar in bars:
            h = bar.get_height()
            ax.annotate(f'{h:.1f}%', xy=(bar.get_x() + bar.get_width() / 2, h),
                        xytext=(0, 2), textcoords='offset points', ha='center', fontsize=8)

    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    ax.set_ylabel("Share of transactions (%)", fontweight='bold')
    ax.set_title(f"System-Wide Load Shift\n"
                 f"(N={mc['systemWideAveraged']['n_treatment_total_across_seeds']:,} simulated transactions, "
                 f"{mc['N_SEEDS']} seeds)", fontweight='bold', pad=12)
    ax.set_ylim(0, max(baseline + treatment) * 1.22)
    ax.legend(loc='upper left', framealpha=0.95)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)

    fig.tight_layout()
    savefig(fig, out_dir, "fig_system_wide_load_shift")


# ===========================================================================
# PART 2 -- On-chain validation figures (onchain_validation_results.json)
# ===========================================================================

def load_feeder(data_dir):
    path = data_dir / "grid_feeder_results.json"
    if not path.exists():
        print(f"  ! {path.name} not found -- run grid_feeder.js and drop its "
              f"output next to this script to generate the 24-hour G(t) figure.")
        return None
    with open(path) as f:
        return json.load(f)


def fig_grid_feeder_timeseries(feeder, out_dir):
    readings = [r for r in feeder["readings"] if r.get("success")]
    if not readings:
        print("  ! No successful feeder readings found -- skipping time-series figure.")
        return
    hours = [r["hour"] for r in readings]
    freq = [r["frequency"] / 1000 for r in readings]
    volt = [r["voltage"] / 1000 for r in readings]
    scores = [r["score"] for r in readings]
    engineered = [r.get("engineered", False) for r in readings]
    verification = [r.get("verification", "unconfirmed_plausible") for r in readings]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(8, 6.2), sharex=True,
                                     gridspec_kw={'height_ratios': [1, 1.2]})

    # --- Top panel: frequency & voltage ---
    l1, = ax1.plot(hours, freq, '-o', color='#1f77b4', markersize=4, label='Frequency (Hz)')
    ax1.set_ylabel("Frequency (Hz)", color='#1f77b4', fontweight='bold')
    ax1.tick_params(axis='y', labelcolor='#1f77b4')
    ax1.axhline(60.0, color='#1f77b4', linestyle=':', linewidth=0.8, alpha=0.5)

    ax1b = ax1.twinx()
    l2, = ax1b.plot(hours, volt, '-s', color='#ff7f0e', markersize=4, label='Voltage (V)')
    ax1b.set_ylabel("Voltage (V)", color='#ff7f0e', fontweight='bold')
    ax1b.tick_params(axis='y', labelcolor='#ff7f0e')
    ax1b.axhline(120.0, color='#ff7f0e', linestyle=':', linewidth=0.8, alpha=0.5)

    for h, is_eng in zip(hours, engineered):
        if is_eng:
            ax1.axvline(h, color='red', linestyle='--', alpha=0.3, linewidth=1)

    ax1.set_title("Synthetic 24-Hour Grid Trace \u2192 Real On-Chain Oracle Response\n"
                  "(22 unengineered noise points, 2 deliberate stress events)",
                  fontweight='bold', pad=12)
    ax1.legend(handles=[l1, l2], loc='lower right', framealpha=0.95, fontsize=8)
    ax1.grid(alpha=0.3, linestyle='--')

    # --- Bottom panel: G(t) ---
    # Point styling reflects ACTUAL verification status, not just engineered/not:
    #   event_log_confirmed  -> solid, confirmed by re-querying the ConditionUpdated
    #                           event at that transaction's own block
    #   unconfirmed_plausible -> normal marker, not independently re-checked, but
    #                           consistent with neighboring readings
    #   suspect_unconfirmed  -> hollow/marked: could not be re-confirmed (RPC
    #                           rate-limit) AND repeats the prior hour's reading
    #                           exactly, the same artifact seen elsewhere in this
    #                           dataset -- shown, not hidden, but flagged
    style = {
        "event_log_confirmed": dict(marker='o', s=60, facecolor=None, edgecolor='black', zorder=4),
        "unconfirmed_plausible": dict(marker='o', s=40, facecolor=None, edgecolor='black', zorder=3),
        "suspect_unconfirmed": dict(marker='X', s=90, facecolor='#ffbb00', edgecolor='black', zorder=5),
    }
    base_color = {True: '#d62728', False: '#2ca02c'}  # engineered vs normal

    ax2.plot(hours, scores, '-', color='gray', linewidth=1, zorder=1)
    for h, s, eng, ver in zip(hours, scores, engineered, verification):
        st = style[ver]
        face = st['facecolor'] if st['facecolor'] else base_color[eng]
        ax2.scatter(h, s, marker=st['marker'], s=st['s'], c=face,
                     edgecolor=st['edgecolor'], linewidth=0.7, zorder=st['zorder'])

    ax2.axhline(0.85, color='black', linestyle='--', linewidth=1.2, label='G_THRESHOLD = 0.85', zorder=2)
    ax2.set_xlabel("Simulated hour of day", fontweight='bold')
    ax2.set_ylabel("Grid stability score G(t)", fontweight='bold')
    ax2.set_ylim(0, 1.05)
    ax2.set_xticks(range(0, 24, 2))
    ax2.grid(alpha=0.3, linestyle='--')

    from matplotlib.lines import Line2D
    handles = [
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#2ca02c', markeredgecolor='black', markersize=9, label='Normal (event-log confirmed)'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#d62728', markeredgecolor='black', markersize=9, label='Engineered stress (event-log confirmed)'),
        Line2D([0], [0], marker='o', color='w', markerfacecolor='#2ca02c', markeredgecolor='black', markersize=7, label='Normal (not independently re-checked)'),
        Line2D([0], [0], marker='X', color='w', markerfacecolor='#ffbb00', markeredgecolor='black', markersize=10, label='Unconfirmed / suspect (see note)'),
        Line2D([0], [0], color='black', linestyle='--', label='G_THRESHOLD = 0.85'),
    ]
    ax2.legend(handles=handles, loc='lower left', framealpha=0.95, fontsize=6.5)

    fig.tight_layout()
    savefig(fig, out_dir, "fig_grid_feeder_timeseries")
    n_confirmed = verification.count("event_log_confirmed")
    n_suspect = verification.count("suspect_unconfirmed")
    print(f"  ({n_confirmed}/24 hours event-log confirmed, {n_suspect} flagged suspect/unconfirmed)")



def load_onchain(data_dir):
    path = data_dir / "onchain_validation_results.json"
    if not path.exists():
        print(f"  ! {path.name} not found -- run onchain_validation.js against "
              f"the new contracts and drop its output next to this script to "
              f"generate the on-chain validation figures.")
        return None
    with open(path) as f:
        return json.load(f)


def _collect_tx_entries(oc):
    entries = []
    entries += list(oc.get("setup", {}).values())
    entries += list(oc.get("oracle", {}).values())
    tw = oc.get("timeWeightedAMM", {})
    entries += [v for k, v in tw.items() if isinstance(v, dict) and 'label' in v]
    entries += oc.get("gridResponsiveAMM", {}).get("swapsNormal", [])
    entries += oc.get("gridResponsiveAMM", {}).get("swapsStressed", [])
    return [e for e in entries if isinstance(e, dict) and e.get("gasUsed")]


def fig_onchain_gas_costs(oc, out_dir):
    entries = _collect_tx_entries(oc)
    if not entries:
        print("  ! No successful on-chain transactions with gas data found -- skipping gas figure.")
        return
    labels = [e["label"] for e in entries]
    gas = [e["gasUsed"] for e in entries]

    fig, ax = plt.subplots(figsize=(9, 4.2))
    bars = ax.bar(range(len(labels)), gas, color='#1f77b4', alpha=0.85, edgecolor='black', linewidth=0.5)
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=45, ha='right', fontsize=7)
    ax.set_ylabel("Gas used", fontweight='bold')
    ax.set_title(f"Gas Cost per Real On-Chain Operation (Sepolia)\n"
                 f"N = {len(entries)} confirmed transactions", fontweight='bold', pad=12)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)
    fig.tight_layout()
    savefig(fig, out_dir, "fig_onchain_gas_costs")


def fig_onchain_stability_scores(oc, out_dir):
    oracle = oc.get("oracle", {})
    normal = oracle.get("readScore_normal", {}).get("value")
    stress_entry = oracle.get("readScore_stress", {})
    stress = stress_entry.get("value")
    if not normal or not stress:
        print("  ! Oracle before/after readings not found -- skipping stability-score figure.")
        return
    norm_score = int(normal["score"]) / 1e18

    correction = stress_entry.get("correction")
    if correction:
        stress_score = correction["correctedScore"]
        stress_is_corrected = True
    else:
        stress_score = int(stress["score"]) / 1e18
        stress_is_corrected = False

    fig, ax = plt.subplots(figsize=(4.8, 4.2))
    bars = ax.bar(["Normal\n(60Hz, 120V)", "Stress test\n(59Hz, 120V)"],
                   [norm_score, stress_score], color=['#2ca02c', '#d62728'],
                   alpha=0.85, edgecolor='black', linewidth=0.5)
    ax.axhline(0.85, color='black', linestyle='--', linewidth=1.2, label='G_THRESHOLD = 0.85')
    for bar, v in zip(bars, [norm_score, stress_score]):
        ax.annotate(f'{v:.3f}', xy=(bar.get_x() + bar.get_width() / 2, v),
                    xytext=(0, 3), textcoords='offset points', ha='center', fontweight='bold')
    if stress_is_corrected:
        ax.annotate('cross-derived (see caption)', xy=(1, 0.93), ha='center',
                     fontsize=7, style='italic', color='#555')
    ax.set_ylim(0, 1.05)
    ax.set_ylabel("Grid stability score G(t)", fontweight='bold')
    title = "Real On-Chain Oracle Reading\nBefore/After Stress Trigger"
    ax.set_title(title, fontweight='bold', pad=12)
    ax.legend(loc='lower left', framealpha=0.95)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    ax.set_axisbelow(True)
    fig.tight_layout()
    savefig(fig, out_dir, "fig_onchain_stability_scores")
    if stress_is_corrected:
        print(f"  (stress score uses math-derived correction: {correction['derivation']})")


def table_onchain_summary(oc, out_dir):
    summary = oc.get("summary", {})
    if not summary:
        print("  ! No summary block found -- skipping on-chain summary table.")
        return
    rows = [
        ["Total operations attempted", summary.get("totalOperations")],
        ["Real transactions submitted", summary.get("totalRealTransactions")],
        ["Successful", summary.get("successCount")],
        ["Failed", summary.get("failureCount")],
        ["Success rate (%)", summary.get("successRatePct")],
        ["Total gas used", summary.get("totalGasUsed")],
        ["Average gas per tx", summary.get("avgGasUsed")],
    ]
    csv_path = out_dir / "table_onchain_validation.csv"
    with open(csv_path, "w", newline='') as f:
        w = csv.writer(f)
        w.writerow(["Metric", "Value"])
        w.writerows(rows)

    tex_path = out_dir / "table_onchain_validation.tex"
    with open(tex_path, "w") as f:
        f.write("\\begin{table}[h]\n\\caption{Real On-Chain Validation Summary (Fixed Contracts, Sepolia)}\n"
                "\\label{tab:onchain_validation}\n\\centering\n\\begin{tabular}{lr}\n\\hline\n"
                "\\textbf{Metric} & \\textbf{Value} \\\\\n\\hline\n")
        for name, val in rows:
            f.write(f"{name} & {val} \\\\\n")
        f.write("\\hline\n\\end{tabular}\n\\end{table}\n")

    print(f"  \u2713 {csv_path.name} / {tex_path.name}")


# ===========================================================================
# MAIN
# ===========================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-dir", default="test/energyresults", help="directory containing the JSON data files (default: test/energyresults, matching the repo layout)")
    ap.add_argument("--out-dir", default="figs", help="directory to write figures/tables into (default: figs, matching the manuscript's \\includegraphics{figs/...} paths)")
    args = ap.parse_args()

    data_dir = Path(args.data_dir)
    out_dir = Path(args.out_dir)

    print("=" * 78)
    print(f"Reading data from : {data_dir.resolve()}")
    print(f"Writing figures to: {out_dir.resolve()}")
    print("=" * 78)
    if not data_dir.exists():
        print(f"\n WARNING: data-dir '{data_dir}' does not exist from the current "
              f"working directory ({Path.cwd()}). Every figure below will be "
              f"skipped. Run this from the repo root, or pass the correct "
              f"--data-dir explicitly.\n")

    out_dir.mkdir(parents=True, exist_ok=True)

    print("Monte Carlo simulation figures (table4_replacement.json):")
    mc = load_montecarlo(data_dir)
    if mc:
        fig_per_prosumer(mc, out_dir)
        r_value = fig_elasticity_correlation(mc, out_dir)
        fig_system_wide(mc, out_dir)
        print(f"  (recomputed elasticity correlation r = {r_value:.4f})")

    print("\nOn-chain validation figures (onchain_validation_results.json):")
    oc = load_onchain(data_dir)
    if oc:
        fig_onchain_gas_costs(oc, out_dir)
        fig_onchain_stability_scores(oc, out_dir)
        table_onchain_summary(oc, out_dir)

    print("\n24-hour grid feeder figure (grid_feeder_results.json):")
    feeder = load_feeder(data_dir)
    if feeder:
        fig_grid_feeder_timeseries(feeder, out_dir)

    print(f"\nAll available figures written to {out_dir.resolve()}")


if __name__ == "__main__":
    main()
