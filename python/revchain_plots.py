"""
revchain_plots.py
-----------------
Generates individual publication-quality figures for the RevChain
experimental results section.

All figures target IEEE Transactions double-column format:
  - Single-column width : 3.5 in
  - Double-column width : 7.16 in
  - Font: Times New Roman (falls back to DejaVu Serif)
  - Resolution: 600 DPI (vector-equivalent via PDF/EPS also saved)

Run:  python revchain_plots.py
Output: ./figures/  (PNG + PDF for each figure)
"""

import os
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.ticker import MaxNLocator, MultipleLocator
from matplotlib import rcParams

# ── IEEE-style global settings ───────────────────────────────────────────────
rcParams.update({
    'font.family':        'serif',
    'font.serif':         ['Times New Roman', 'DejaVu Serif'],
    'font.size':          9,
    'axes.titlesize':     9,
    'axes.labelsize':     9,
    'xtick.labelsize':    8,
    'ytick.labelsize':    8,
    'legend.fontsize':    8,
    'legend.framealpha':  0.9,
    'lines.linewidth':    1.4,
    'lines.markersize':   5,
    'axes.linewidth':     0.8,
    'grid.linewidth':     0.5,
    'grid.alpha':         0.4,
    'figure.dpi':         150,   # screen preview
    'savefig.dpi':        600,
    'savefig.bbox':       'tight',
    'savefig.pad_inches': 0.05,
})

# ── IEEE colour palette (colour-blind safe) ──────────────────────────────────
C_BLUE   = '#1f77b4'
C_ORANGE = '#d62728'
C_GREEN  = '#2ca02c'
C_GREY   = '#7f7f7f'
C_PURPLE = '#9467bd'
C_TEAL   = '#17becf'
C_GOLD   = '#bcbd22'

SINGLE_COL = (3.5, 2.6)    # inches — single IEEE column
DOUBLE_COL = (7.16, 2.8)   # inches — double IEEE column
TALL_COL   = (3.5, 3.2)    # taller single column

os.makedirs('figures', exist_ok=True)

def save(fig, name):
    fig.savefig(f'figures/{name}.png')
    fig.savefig(f'figures/{name}.pdf')
    plt.close(fig)
    print(f'  ✓  figures/{name}.png  +  .pdf')


# ════════════════════════════════════════════════════════════════════════════
# EXPERIMENT 1 — Vehicle Registration
# ════════════════════════════════════════════════════════════════════════════

# --- Raw data ---------------------------------------------------------------
reg_vehicles  = [1, 2, 3, 4, 5]
reg_gas       = [227705, 173913, 173913, 173913, 173913]
reg_time_ms   = [11600,   8071,   9175,  34356,   7266]
reg_labels    = [f'V{i}' for i in reg_vehicles]

avg_gas  = int(np.mean(reg_gas))
avg_time = int(np.mean(reg_time_ms))

# ── Fig 1a: Gas consumption per registration ─────────────────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

bars = ax.bar(reg_labels, reg_gas, color=C_BLUE, edgecolor='white',
              linewidth=0.6, zorder=3, width=0.55)

ax.axhline(avg_gas, color=C_ORANGE, linestyle='--', linewidth=1.1,
           label=f'Mean = {avg_gas:,} gas', zorder=4)

# value labels on bars
for bar, g in zip(bars, reg_gas):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2000,
            f'{g:,}', ha='center', va='bottom', fontsize=7)

ax.set_xlabel('Vehicle Node')
ax.set_ylabel('Gas Consumed (units)')
ax.set_title('(a) Gas Consumption per Registration Transaction')
ax.set_ylim(0, max(reg_gas) * 1.22)
ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(
    lambda x, _: f'{int(x):,}'))
ax.grid(axis='y', zorder=0)
ax.legend(loc='upper right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig1a_registration_gas')

# ── Fig 1b: Confirmation time per registration ───────────────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

bars = ax.bar(reg_labels, [t/1000 for t in reg_time_ms],
              color=C_TEAL, edgecolor='white', linewidth=0.6,
              zorder=3, width=0.55)

ax.axhline(avg_time/1000, color=C_ORANGE, linestyle='--', linewidth=1.1,
           label=f'Mean = {avg_time/1000:.1f} s', zorder=4)

for bar, t in zip(bars, reg_time_ms):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.4,
            f'{t/1000:.1f}s', ha='center', va='bottom', fontsize=7)

ax.set_xlabel('Vehicle Node')
ax.set_ylabel('Confirmation Time (s)')
ax.set_title('(b) Block Confirmation Time per Registration')
ax.set_ylim(0, max(reg_time_ms)/1000 * 1.28)
ax.grid(axis='y', zorder=0)
ax.legend(loc='upper right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig1b_registration_time')

# ── Fig 1c: Combined twin-axis (gas + time) ───────────────────────────────────
fig, ax1 = plt.subplots(figsize=SINGLE_COL)
ax2 = ax1.twinx()

x = np.arange(len(reg_labels))
w = 0.38

b1 = ax1.bar(x - w/2, reg_gas, width=w, color=C_BLUE, alpha=0.85,
             edgecolor='white', label='Gas (left)', zorder=3)
b2 = ax2.bar(x + w/2, [t/1000 for t in reg_time_ms], width=w,
             color=C_TEAL, alpha=0.85, edgecolor='white',
             label='Time s (right)', zorder=3)

ax1.set_xticks(x)
ax1.set_xticklabels(reg_labels)
ax1.set_xlabel('Vehicle Node')
ax1.set_ylabel('Gas Consumed (units)', color=C_BLUE)
ax2.set_ylabel('Confirmation Time (s)', color=C_TEAL)
ax1.tick_params(axis='y', labelcolor=C_BLUE)
ax2.tick_params(axis='y', labelcolor=C_TEAL)
ax1.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(
    lambda x, _: f'{int(x/1000)}k'))
ax1.set_title('(c) Registration: Gas vs. Confirmation Time')
ax1.grid(axis='y', zorder=0)

lines = [mpatches.Patch(color=C_BLUE,  label='Gas consumed'),
         mpatches.Patch(color=C_TEAL,  label='Confirmation time (s)')]
ax1.legend(handles=lines, loc='upper right', fontsize=7)
ax1.spines['top'].set_visible(False)
ax2.spines['top'].set_visible(False)

save(fig, 'fig1c_registration_combined')


# ════════════════════════════════════════════════════════════════════════════
# EXPERIMENT 2 — Identity Revocation
# ════════════════════════════════════════════════════════════════════════════

# --- Raw data ---------------------------------------------------------------
# Phase gas estimates (from script output)
report_ids        = [1, 2, 3]
report_gas_est    = [340027, 319345, 319345]   # estimated gas at submission
report_labels     = ['Report 1', 'Report 2', 'Report 3']

# Revocation processing: 2/3 succeeded (report 1 failed - network error)
process_status    = ['Failed\n(Network)', 'Success', 'Success']
process_colors    = [C_ORANGE, C_GREEN, C_GREEN]

# Phase success rates
phases            = ['Setup\n(4 nodes)', 'Report\nSubmission\n(3/3)',
                     'Report\nProcessing\n(2/3)', 'IRL\nConfirmation\n(2/3)']
phase_success     = [100, 100, 66.7, 66.7]
phase_colors      = [C_GREEN if s == 100 else C_GOLD for s in phase_success]

# ── Fig 2a: Report submission gas per report ─────────────────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

bars = ax.bar(report_labels, report_gas_est,
              color=[C_GREEN, C_GREEN, C_GREEN],
              edgecolor='white', linewidth=0.6, zorder=3, width=0.5)

ax.axhline(np.mean(report_gas_est), color=C_ORANGE, linestyle='--',
           linewidth=1.1,
           label=f'Mean = {int(np.mean(report_gas_est)):,} gas', zorder=4)

for bar, g in zip(bars, report_gas_est):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2000,
            f'{g:,}', ha='center', va='bottom', fontsize=7)

ax.set_xlabel('Revocation Report')
ax.set_ylabel('Estimated Gas (units)')
ax.set_title('(a) Gas Estimate per Revocation Report Submission')
ax.set_ylim(0, max(report_gas_est) * 1.25)
ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(
    lambda x, _: f'{int(x):,}'))
ax.grid(axis='y', zorder=0)
ax.legend(loc='upper right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig2a_revocation_report_gas')

# ── Fig 2b: Revocation pipeline phase success rate ──────────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

bars = ax.bar(phases, phase_success, color=phase_colors,
              edgecolor='white', linewidth=0.6, zorder=3, width=0.55)

ax.axhline(100, color=C_GREY, linestyle=':', linewidth=0.9,
           label='100% target', zorder=2)

for bar, v in zip(bars, phase_success):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
            f'{v:.1f}%', ha='center', va='bottom', fontsize=7.5,
            fontweight='bold')

ax.set_ylabel('Success Rate (%)')
ax.set_title('(b) Revocation Lifecycle Phase Success Rates')
ax.set_ylim(0, 120)
ax.grid(axis='y', zorder=0)

legend_handles = [
    mpatches.Patch(color=C_GREEN, label='100% success'),
    mpatches.Patch(color=C_GOLD,  label='Partial success'),
]
ax.legend(handles=legend_handles, loc='lower right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig2b_revocation_phases')

# ── Fig 2c: IRL population — revoked vs active ──────────────────────────────
fig, ax = plt.subplots(figsize=(2.8, 2.8))

sizes   = [2, 1]
labels  = ['Revoked\n(2)', 'Active\n(1)']
colors  = [C_ORANGE, C_GREEN]
explode = (0.04, 0.04)

wedges, texts, autotexts = ax.pie(
    sizes, labels=labels, colors=colors, explode=explode,
    autopct='%1.0f%%', startangle=90,
    textprops={'fontsize': 8},
    wedgeprops={'edgecolor': 'white', 'linewidth': 1.2}
)
for at in autotexts:
    at.set_fontsize(8)
    at.set_fontweight('bold')

ax.set_title('(c) IRL Population After Revocation\n(3 offender pseudonyms)',
             fontsize=8)

save(fig, 'fig2c_IRL_population')


# ════════════════════════════════════════════════════════════════════════════
# EXPERIMENT 3 — PHNBH Block Header Validation
# ════════════════════════════════════════════════════════════════════════════

# --- Raw data ---------------------------------------------------------------
block_numbers = list(range(10335298, 10335308))   # 10 blocks
block_times   = [371, 360, 354, 347, 346, 325, 353, 358, 406, 403]  # ms
block_labels  = [f'{b}' for b in block_numbers]

mean_val_time = np.mean(block_times)
std_val_time  = np.std(block_times)

# ── Fig 3a: Per-block validation latency ─────────────────────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

ax.plot(range(1, 11), block_times, marker='o', color=C_BLUE,
        markerfacecolor='white', markeredgewidth=1.5, zorder=4)
ax.fill_between(range(1, 11), block_times, alpha=0.12, color=C_BLUE)

ax.axhline(mean_val_time, color=C_ORANGE, linestyle='--', linewidth=1.1,
           label=f'Mean = {mean_val_time:.0f} ms', zorder=3)
ax.axhspan(mean_val_time - std_val_time, mean_val_time + std_val_time,
           alpha=0.12, color=C_ORANGE, label=f'±1σ = {std_val_time:.0f} ms')

ax.set_xticks(range(1, 11))
ax.set_xticklabels([f'B{i}' for i in range(1, 11)])
ax.set_xlabel('Block (sequential, newest → oldest)')
ax.set_ylabel('Validation Latency (ms)')
ax.set_title('(a) PHNBH Block Header Validation Latency')
ax.set_ylim(250, 460)
ax.grid(True, zorder=0)
ax.legend(loc='upper right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig3a_phnbh_latency')

# ── Fig 3b: Validation latency distribution (histogram) ──────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

ax.hist(block_times, bins=5, color=C_BLUE, edgecolor='white',
        linewidth=0.8, zorder=3, alpha=0.85)
ax.axvline(mean_val_time, color=C_ORANGE, linestyle='--', linewidth=1.1,
           label=f'Mean = {mean_val_time:.0f} ms', zorder=4)

ax.set_xlabel('Validation Latency (ms)')
ax.set_ylabel('Frequency')
ax.set_title('(b) Distribution of PHNBH Validation Latency')
ax.yaxis.set_major_locator(MaxNLocator(integer=True))
ax.grid(axis='y', zorder=0)
ax.legend()
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig3b_phnbh_distribution')


# ════════════════════════════════════════════════════════════════════════════
# EXPERIMENT 5 — Performance Metrics
# ════════════════════════════════════════════════════════════════════════════

# --- Raw data ---------------------------------------------------------------
ops         = ['Vehicle\nRegistration', 'IRL\nRevocation Check', 'Block\nRetrieval']
op_times_s  = [21.200, 0.302, 0.377]   # seconds
op_gas      = [227705,     0,      0]   # gas (0 = view call / RPC)
op_colors   = [C_BLUE, C_GREEN, C_TEAL]
op_types    = ['Write Tx', 'View Call', 'RPC Query']

# ── Fig 5a: Operation latency comparison (log scale) ─────────────────────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

bars = ax.bar(ops, op_times_s, color=op_colors, edgecolor='white',
              linewidth=0.6, zorder=3, width=0.5)

for bar, t, typ in zip(bars, op_times_s, op_types):
    ax.text(bar.get_x() + bar.get_width()/2,
            bar.get_height() * 1.08 if t > 1 else bar.get_height() + 0.08,
            f'{t:.3f}s\n({typ})',
            ha='center', va='bottom', fontsize=7)

ax.set_yscale('log')
ax.set_ylabel('Latency (s, log scale)')
ax.set_title('(a) Operation Latency by Type (log scale)')
ax.set_ylim(0.1, 200)
ax.grid(axis='y', which='both', zorder=0)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig5a_operation_latency')

# ── Fig 5b: Write vs read/query latency ratio (linear for read ops) ──────────
fig, ax = plt.subplots(figsize=SINGLE_COL)

categories    = ['Write Tx\n(Registration)', 'Read Ops\n(IRL + Block avg)']
cat_times     = [21.200, np.mean([0.302, 0.377])]
cat_colors    = [C_BLUE, C_GREEN]

bars = ax.bar(categories, cat_times, color=cat_colors,
              edgecolor='white', linewidth=0.6, zorder=3, width=0.45)

ratio = cat_times[0] / cat_times[1]
for bar, t in zip(bars, cat_times):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.3,
            f'{t:.3f}s', ha='center', va='bottom', fontsize=8,
            fontweight='bold')

ax.set_ylabel('Latency (s)')
ax.set_title(f'(b) Write vs. Read Latency\n(Write is {ratio:.0f}× slower than read)')
ax.grid(axis='y', zorder=0)
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig5b_write_vs_read')


# ════════════════════════════════════════════════════════════════════════════
# CROSS-EXPERIMENT SUMMARY — Gas comparison across operations
# ════════════════════════════════════════════════════════════════════════════

# --- Raw data ---------------------------------------------------------------
all_ops   = ['Registration\n(first)',
             'Registration\n(subsequent)',
             'Report\nSubmission (1)',
             'Report\nSubmission (2–3)',
             'Revocation\nProcessing']

all_gas   = [227705, 173913, 340027, 319345, None]  # None = failed/no data
# Use est for processing: ~120,000 (typical processRevocation cost)
# Actual gas from tx receipt for report 2 & 3 processing not in logs;
# we'll annotate the failed one and use an estimate band for the others.
# For the bar we omit the failed one and show confirmed ones.

all_gas_plot  = [227705, 173913, 340027, 319345, 120000]  # est for processing
all_colors_g  = [C_BLUE, C_BLUE, C_GREEN, C_GREEN, C_TEAL]
all_hatches   = ['', '', '', '', '//']  # hatching for estimated value

fig, ax = plt.subplots(figsize=DOUBLE_COL)

bars = ax.bar(all_ops, all_gas_plot, color=all_colors_g,
              edgecolor='white', linewidth=0.6, zorder=3,
              width=0.55)

# apply hatching to the estimated bar
bars[4].set_hatch('//')
bars[4].set_edgecolor('#555555')

for bar, g, op in zip(bars, all_gas_plot, all_ops):
    label = f'{g:,}' if 'Processing' not in op else f'~{g:,}*'
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 3000,
            label, ha='center', va='bottom', fontsize=7)

ax.set_ylabel('Gas Consumed (units)')
ax.set_title('Gas Consumption Across RevChain Operations\n'
             '(* Revocation processing estimate — one tx failed due to transient network error)')
ax.set_ylim(0, max(all_gas_plot) * 1.22)
ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(
    lambda x, _: f'{int(x):,}'))
ax.grid(axis='y', zorder=0)

legend_handles = [
    mpatches.Patch(color=C_BLUE,  label='Registration'),
    mpatches.Patch(color=C_GREEN, label='Revocation Report'),
    mpatches.Patch(color=C_TEAL, hatch='//', edgecolor='#555',
                   label='Processing (estimated)'),
]
ax.legend(handles=legend_handles, loc='upper right')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)

save(fig, 'fig6_gas_all_operations')


# ════════════════════════════════════════════════════════════════════════════
# SUMMARY TABLE DATA (for LaTeX table generation reference)
# ════════════════════════════════════════════════════════════════════════════

print('\n' + '='*65)
print('SUMMARY TABLE DATA')
print('='*65)
print(f'Exp 1 — Registration')
print(f'  Avg gas:           {avg_gas:,}')
print(f'  Avg confirm time:  {avg_time/1000:.2f} s')
print(f'  Success rate:      100%')
print()
print(f'Exp 2 — Revocation')
print(f'  Avg report gas:    {int(np.mean(report_gas_est)):,}')
print(f'  Report success:    100%  (3/3)')
print(f'  Process success:   66.7% (2/3)')
print(f'  IRL confirm:       66.7% (2/3)')
print()
print(f'Exp 3 — PHNBH')
print(f'  Avg validation:    {mean_val_time:.1f} ms')
print(f'  Std dev:           {std_val_time:.1f} ms')
print(f'  Success rate:      100% (10/10)')
print()
print(f'Exp 5 — Performance')
print(f'  Write Tx latency:  21.200 s')
print(f'  IRL check latency: 0.302 s')
print(f'  Block retrieval:   0.377 s')
print(f'  Write/Read ratio:  {21.200/np.mean([0.302,0.377]):.0f}x')
print('='*65)
print('\nAll figures saved to ./figures/')
