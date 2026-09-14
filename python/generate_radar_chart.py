"""
generate_radar_chart.py
------------------------
Rebuilds the comparative radar chart (old Figure 5) to match the corrected
manuscript numbers. This is a DIFFERENT kind of figure than the ones in
generate_figures.py: those are built from real experiment JSON files, this
one is built from the qualitative comparison already written into the
manuscript's "Comprehensive System Comparison" table (Table
tab:comprehensive_comparison), since a real deployed system can only be
compared to prior work on the dimensions prior work actually reports.

WHY THIS LOOKS DIFFERENT FROM THE OLD RADAR: the old chart normalized six
quantitative metrics (peak reduction, RE adoption, CO2 reduction, cost
savings, recovery time, transaction cost) to 0-100 and plotted all five
systems on them. Four of those six no longer exist as real numbers for our
system (RE adoption, CO2, recovery time were never instrumented; see
Section "Environmental Impact: Not Reported" in the manuscript), so a
six-axis QUANTITATIVE radar can no longer be built honestly.

WHAT THIS SCRIPT DOES INSTEAD: axis 1 (Peak Demand Reduction) is the only
directly quantitative, apples-to-apples axis, normalized against the
highest reported value across all five systems (18%, Tushar et al.). Axes
2-6 are AUTHOR-ASSIGNED CAPABILITY SCORES (0-100), not measured metrics --
each one is a transparent, documented conversion of the corresponding
qualitative table cell (e.g. "Dynamic Fees: Yes/No" -> 100/0) into a
plottable number. The scoring rationale for every cell is written out below
in SCORING_NOTES so a reader (or a co-author who disagrees with a score)
can see exactly how each number was derived and adjust it.

This is a judgment call, not a measurement. Change the SCORES dict below if
you'd score any system differently -- nothing here is derived from a JSON
file, so there's no "real data" to preserve by leaving it alone.

Usage:
    python3 generate_radar_chart.py [--out-dir figs]
"""

import argparse
from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams

rcParams['font.family'] = 'serif'
rcParams['font.size'] = 9

SYSTEMS = ["Our System", "Liu et al.", "Zhang et al.", "Tushar et al.", "Hua et al."]

AXES = [
    "Peak Demand\nReduction",
    "Real-World /\nOn-Chain Deployment",
    "Grid-Responsive\nDynamic Fees",
    "Automated\nTemporal Pricing",
    "Intermediary-Free\nOperation",
    "Algorithmic Price\nDiscovery",
]

# Every row traces to a specific cell in Table tab:comprehensive_comparison
# in the manuscript. See SCORING_NOTES for the conversion rationale.
SCORES = {
    "Our System":    [6.7/18*100,  100,  100,  100,  100,  100],
    "Liu et al.":    [15/18*100,   10,   0,    40,   0,    15],
    "Zhang et al.":  [12/18*100,   60,   0,    10,   0,    25],
    "Tushar et al.": [18/18*100,   5,    0,    0,    0,    55],
    "Hua et al.":    [0,           50,   0,    30,   0,    45],
}

SCORING_NOTES = """
Axis 1 (Peak Demand Reduction) -- directly quantitative, normalized against
  the highest reported value (18%, Tushar et al.). Hua et al. did not
  report this metric; scored 0 for "not reported", not "reported zero
  effect" -- see the hatched bar / footnote in the figure.

Axis 2 (Real-World / On-Chain Deployment) -- from the "Deployment
  Environment" and "Real Sepolia Transactions" table rows:
    Our System 100  - public Sepolia testnet, 45 real signed transactions, 100% success
    Liu et al. 10   - private network, no public deployment reported
    Zhang et al. 60 - LV grid-connected microgrid, experimental but real-world
    Tushar et al. 5 - simulation only
    Hua et al. 50   - GB power system case study (real data, not a live deployed system)

Axis 3 (Grid-Responsive Dynamic Fees) -- binary, from the "Dynamic Fees" row:
    Our System 100 (yes); all four prior systems 0 (no dynamic/grid-responsive fee mechanism reported)

Axis 4 (Automated Temporal Pricing) -- from the "Temporal Pricing" row:
    Our System 100  - fully automated tau(t), no manual step
    Liu et al. 40   - dynamic internal pricing, but manually updated
    Zhang et al. 10 - fixed pricing
    Tushar et al. 0 - no temporal pricing mechanism
    Hua et al. 30   - carbon price iterations (dynamic, but not temporal-demand-specific)

Axis 5 (Intermediary-Free Operation) -- binary, from the "Intermediary-Free" row:
    Our System 100 (yes); Liu (DSO required), Zhang (platform operator), Tushar (auctioneer),
    Hua (utility-led) all 0 (each requires a coordinating intermediary)

Axis 6 (Algorithmic Price Discovery) -- from the "Price Discovery" row, ranked by
  how automated/instantaneous price setting is:
    Our System 100  - algorithmic AMM, instant, no negotiation
    Liu et al. 15   - centralized SDR-based forecasting
    Zhang et al. 25 - platform operator sets price
    Tushar et al. 55 - game-theoretic equilibrium, computed but not real-time market clearing
    Hua et al. 45   - Stackelberg equilibrium, computed iteratively
"""

COLORS = {
    "Our System": "#1f77b4", "Liu et al.": "#d62728", "Zhang et al.": "#2ca02c",
    "Tushar et al.": "#ff7f0e", "Hua et al.": "#9467bd",
}


def make_radar(out_dir: Path):
    n = len(AXES)
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    angles += angles[:1]

    fig, ax = plt.subplots(figsize=(7, 7), subplot_kw=dict(polar=True))
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(AXES, fontsize=8.5)
    ax.set_ylim(0, 100)
    ax.set_yticks([20, 40, 60, 80, 100])
    ax.set_yticklabels(["20", "40", "60", "80", "100"], fontsize=7, color='gray')
    ax.grid(alpha=0.3)

    for name in SYSTEMS:
        vals = SCORES[name][:]
        vals += vals[:1]
        lw = 2.4 if name == "Our System" else 1.3
        alpha_line = 1.0 if name == "Our System" else 0.75
        ax.plot(angles, vals, linewidth=lw, label=name, color=COLORS[name], alpha=alpha_line)
        if name == "Our System":
            ax.fill(angles, vals, color=COLORS[name], alpha=0.12)

    # Mark Hua's "not reported" peak-reduction axis explicitly rather than
    # letting a 0 silently read as "measured and found to be zero"
    ax.annotate("Hua et al.: N/R", xy=(angles[0], 0), xytext=(angles[0] + 0.55, 18),
                fontsize=7, color=COLORS["Hua et al."], ha='center', style='italic',
                arrowprops=dict(arrowstyle='-', color=COLORS["Hua et al."], alpha=0.6, lw=0.8))

    ax.legend(loc='upper right', bbox_to_anchor=(1.35, 1.1), fontsize=8, framealpha=0.95)
    ax.set_title("Capability Comparison Across Systems\n"
                  "(Axis 1 is quantitative; axes 2\u20136 are author-assigned\n"
                  "capability scores -- see figure note / SCORING_NOTES)",
                  fontsize=10, fontweight='bold', pad=30)

    fig.tight_layout()
    out_dir.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_dir / "figure5_comparative_radar.png", dpi=300, bbox_inches='tight')
    fig.savefig(out_dir / "figure5_comparative_radar.pdf", bbox_inches='tight')
    plt.close(fig)
    print(f"  \u2713 figure5_comparative_radar.png / .pdf written to {out_dir.resolve()}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="figs", help="directory to write the figure into (default: figs)")
    args = ap.parse_args()
    make_radar(Path(args.out_dir))
    print("\nScoring rationale for every axis/system (also in this file's SCORING_NOTES):")
    print(SCORING_NOTES)


if __name__ == "__main__":
    main()
