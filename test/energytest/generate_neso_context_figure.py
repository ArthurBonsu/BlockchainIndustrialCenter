#!/usr/bin/env python3
"""
generate_neso_context_figure.py
-------------------------------------------------------------------------------
Compares the tau(t) schedule of the Time-Weighted AMM (tau_peak=1.35 at
17:00-21:00, tau_off-peak=0.75 at 23:00-06:00, 1.0 otherwise) with three REAL
GB datasets published by NESO:

  (a) Historic Demand Data   -> national demand (ND), half-hourly, 2026
  (a) Day-Ahead Power Exchange prices (Nord Pool) -> hourly price, 2021-2026
  (b) Demand Flexibility Service utilisation report -> accepted 'Downwards'
      (demand-reduction) events, delivery dates 2026-04-14 onward

This is a DESCRIPTIVE design check: it shows where real GB demand and prices
peak and where real demand-reduction events are called. It does not test the
AMM and says nothing about load shifting; that evidence is the Monte Carlo
simulation and the on-chain validation.

Time handling (important):
  * Demand settlement periods are UK clock time; the day-ahead price file has
    24 rows per day with no daylight-saving gaps, which indicates UTC (this is
    an inference, not stated in the file). To keep both unambiguous, (a) uses
    WINTER months only, when UK clock time equals GMT/UTC:
      demand  : Jan-Feb 2026, weekdays
      prices  : Nov-Feb (all available winters 2021-26), weekdays
  * DFS (b) uses the From_Local column (UK clock time) of each event.

Usage (from the project root):
  python test/energytest/generate_neso_context_figure.py
  python test/energytest/generate_neso_context_figure.py --demand path.csv --dfs path.csv --prices path.csv

Defaults look in test/energytest/neso_data/ for:
  demanddataupdate_2026.csv, dfs-utilisation-report.csv, day_ahead_prices.csv
Outputs (default test/energyresults/): fig_neso_context.pdf/.png and
neso_context_stats.json
-------------------------------------------------------------------------------
"""
import argparse
import json
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--demand", default=os.path.join(HERE, "neso_data", "demanddataupdate_2026.csv"))
ap.add_argument("--dfs", default=os.path.join(HERE, "neso_data", "dfs-utilisation-report.csv"))
ap.add_argument("--prices", default=os.path.join(HERE, "neso_data", "day_ahead_prices.csv"))
ap.add_argument("--out-dir", default=os.path.join(HERE, "..", "energyresults"))
args = ap.parse_args()
os.makedirs(args.out_dir, exist_ok=True)

# ---- tau(t) schedule from the manuscript ------------------------------------
TAU_PEAK, TAU_OFF, TAU_NORMAL = 1.35, 0.75, 1.0
PEAK_HOURS = range(17, 21)                 # 17:00-21:00
OFF_HOURS = list(range(23, 24)) + list(range(0, 6))   # 23:00-06:00
tau = np.full(24, TAU_NORMAL)
tau[list(PEAK_HOURS)] = TAU_PEAK
tau[OFF_HOURS] = TAU_OFF


def profile_stats(prof):
    prof = np.asarray(prof, dtype=float)
    peak = prof[list(PEAK_HOURS)].mean()
    off = prof[OFF_HOURS].mean()
    return {
        "peak_window_over_daily_mean": float(peak / prof.mean()),
        "offpeak_window_over_daily_mean": float(off / prof.mean()),
        "peak_over_offpeak_ratio": float(peak / off),
        "peak_hour_start": int(prof.argmax()),
        "lowest_hour_start": int(prof.argmin()),
        "pearson_r_with_tau": float(np.corrcoef(prof, tau)[0, 1]),
    }


# ---- demand: national demand (ND), half-hourly -> hourly mean ----------------
d = pd.read_csv(args.demand)
d["date"] = pd.to_datetime(d["SETTLEMENT_DATE"])
d["hour"] = (d["SETTLEMENT_PERIOD"] - 1) // 2          # SP1 = 00:00-00:30
dsel = d[(d["date"] >= "2026-01-01") & (d["date"] <= "2026-02-28") & (d["date"].dt.weekday < 5)]
demand_prof = dsel.groupby("hour")["ND"].mean().reindex(range(24)).values

# ---- day-ahead prices: hourly, winter weekdays -------------------------------
p = pd.read_csv(args.prices)
p["date"] = pd.to_datetime(p["Date"])
p["hour"] = p["Delivery Period"].str[:2].astype(int)
psel = p[p["date"].dt.month.isin([11, 12, 1, 2]) & (p["date"].dt.weekday < 5)]
price_prof = psel.groupby("hour")["Price"].mean().reindex(range(24)).values

# ---- DFS: accepted downward events by UK clock start hour --------------------
f = pd.read_csv(args.dfs, encoding="utf-8-sig")
f["date"] = pd.to_datetime(f["Delivery Date"], format="%d/%m/%Y")
acc = f[(f["Status"] == "Accepted") & (f["Event Type"] == "Downwards")].copy()
acc["hour"] = acc["From_Local"].str[:2].astype(int)
dfs_mw = acc.groupby("hour")["DFS Procured MW"].sum().reindex(range(24), fill_value=0.0)
dfs_share = (dfs_mw / dfs_mw.sum()).values

stats = {
    "tau_schedule": {"peak_hours": "17:00-21:00", "offpeak_hours": "23:00-06:00",
                     "tau_peak": TAU_PEAK, "tau_offpeak": TAU_OFF,
                     "tau_peak_over_offpeak": TAU_PEAK / TAU_OFF},
    "demand_ND": {"period": "Jan-Feb 2026 weekdays", "days": int(dsel["date"].nunique()),
                  **profile_stats(demand_prof)},
    "day_ahead_price": {"period": "Nov-Feb weekdays, 2021-2026", "days": int(psel["date"].nunique()),
                        **profile_stats(price_prof)},
    "dfs_downward": {
        "delivery_dates": f"{f['date'].min().date()} to {f['date'].max().date()}",
        "events_total": int(f["Event ID"].nunique()),
        "events_with_accepted_downward": int(acc["Event ID"].nunique()),
        "procured_MW_sum_over_unit_events": float(acc["DFS Procured MW"].sum()),
        "share_procured_MW_starting_17_to_20_local": float(dfs_share[17:21].sum()),
        "share_procured_MW_starting_16_to_20_local": float(dfs_share[16:21].sum()),
        "peak_start_hour_local": int(dfs_share.argmax()),
    },
}
with open(os.path.join(args.out_dir, "neso_context_stats.json"), "w") as fh:
    json.dump(stats, fh, indent=2)

# ---- figure ------------------------------------------------------------------
INK, INK2, GRID, SURFACE = "#0b0b0b", "#52514e", "#e4e3df", "#fcfcfb"
C_DEMAND, C_PRICE, C_DFS, C_TAU = "#2a78d6", "#eb6834", "#1baf7a", "#52514e"

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 8, "axes.edgecolor": GRID, "axes.labelcolor": INK2,
    "xtick.color": INK2, "ytick.color": INK2, "text.color": INK, "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE, "pdf.fonttype": 42,
})
fig, (ax, bx) = plt.subplots(1, 2, figsize=(7.4, 3.0), gridspec_kw={"width_ratios": [1.45, 1]})
hrs = np.arange(24)

# (a) relative level: each series divided by its own 24-hour mean; tau as stated
for lo, hi, a in ((17, 21, 0.10), (23, 24, 0.06), (0, 6, 0.06)):
    ax.axvspan(lo, hi, color=C_TAU, alpha=a, lw=0)
ax.step(np.r_[hrs, 24], np.r_[tau, tau[-1]], where="post", color=C_TAU, lw=1.6, ls="--", label=r"$\tau(t)$ schedule")
ax.plot(hrs + 0.5, demand_prof / demand_prof.mean(), color=C_DEMAND, lw=1.6, marker="o", ms=3.2, label="GB demand (ND)")
ax.plot(hrs + 0.5, price_prof / price_prof.mean(), color=C_PRICE, lw=1.6, marker="s", ms=3.2, label="Day-ahead price")
ax.set_xlim(0, 24)
ax.set_xticks(range(0, 25, 3))
ax.set_xlabel("Hour of day (GMT, winter weekdays)")
ax.set_ylabel("Relative level (daily mean = 1)")
ax.set_ylim(0.6, 1.65)
ax.grid(axis="y", color=GRID, lw=0.6)
ax.spines[["top", "right"]].set_visible(False)
ax.text(19.6, 1.635, "peak 17-21", ha="center", va="top", fontsize=7, color=INK2)
ax.text(3, 1.635, "off-peak 23-06", ha="center", va="top", fontsize=7, color=INK2)
ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.22), ncol=3, frameon=False, fontsize=7.5, handlelength=2.2)
ax.set_title("(a) Real GB demand and prices vs. the τ(t) schedule", loc="left", fontsize=8.5, color=INK)

# (b) DFS accepted demand-reduction events by start hour
for lo, hi, a in ((17, 21, 0.10), (23, 24, 0.06), (0, 6, 0.06)):
    bx.axvspan(lo, hi, color=C_TAU, alpha=a, lw=0)
bx.bar(hrs + 0.5, dfs_share * 100, width=0.72, color=C_DFS, lw=0)
bx.set_xlim(0, 24)
bx.set_xticks(range(0, 25, 3))
bx.set_xlabel("Event start hour (UK clock time)")
bx.set_ylabel("Share of procured MW (%)")
bx.grid(axis="y", color=GRID, lw=0.6)
bx.spines[["top", "right"]].set_visible(False)
bx.set_title("(b) NESO Demand Flexibility Service,\ndownward events", loc="left", fontsize=8.5, color=INK)
bx.text(0.03, 0.95, f"{stats['dfs_downward']['share_procured_MW_starting_17_to_20_local']*100:.0f}% start 17:00–21:00",
        transform=bx.transAxes, ha="left", va="top", fontsize=7.5, color=INK2)

fig.tight_layout()
for ext in ("pdf", "png"):
    fig.savefig(os.path.join(args.out_dir, f"fig_neso_context.{ext}"), dpi=300, facecolor=SURFACE)
print(json.dumps(stats, indent=2))
print("Wrote fig_neso_context.pdf/.png and neso_context_stats.json to", os.path.abspath(args.out_dir))
