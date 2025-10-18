import matplotlib.pyplot as plt
import numpy as np
import matplotlib.patches as mpatches
import os

# Create output directory if it doesn't exist
output_dir = 'results_figures'
os.makedirs(output_dir, exist_ok=True)

# Set style for publication quality
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.size'] = 10
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['grid.alpha'] = 0.3

print(f"Generating figures in: {os.path.abspath(output_dir)}")

# Figure 1: Schema Integration Complexity Comparison
print("\n[1/5] Generating complexity comparison...")
fig1, ax1 = plt.subplots(figsize=(6, 4))
n_systems = np.arange(3, 21)
traditional = n_systems * (n_systems - 1) / 2
uis_approach = 2 * n_systems

ax1.plot(n_systems, traditional, 'o-', linewidth=2, markersize=6, 
         label='Traditional O(N²)', color='#e74c3c')
ax1.plot(n_systems, uis_approach, 's-', linewidth=2, markersize=6, 
         label='UIS O(N)', color='#27ae60')

ax1.set_xlabel('Number of Data Systems (N)', fontweight='bold')
ax1.set_ylabel('Required Schema Mappings', fontweight='bold')
ax1.set_title('Schema Integration Complexity Comparison', fontweight='bold', pad=15)
ax1.legend(loc='upper left', frameon=True, shadow=True)
ax1.grid(True, alpha=0.3)
ax1.set_xlim(2, 21)
ax1.set_ylim(0, 210)

# Add annotation
ax1.annotate(f'At N=20:\nTraditional: 190\nUIS: 40\n4.75× reduction', 
             xy=(17, 150), fontsize=9, 
             bbox=dict(boxstyle='round,pad=0.5', facecolor='wheat', alpha=0.7))

plt.tight_layout()
plt.savefig(f'{output_dir}/fig_complexity_comparison.pdf', dpi=300, bbox_inches='tight')
plt.savefig(f'{output_dir}/fig_complexity_comparison.png', dpi=300, bbox_inches='tight')
plt.close()
print("    ✓ fig_complexity_comparison.pdf/png")

# Figure 2: Gas Consumption by Operation Type
print("[2/5] Generating gas consumption chart...")
fig2, ax2 = plt.subplots(figsize=(6, 4))
operations = ['Source\nRegistration', 'Transform\nMapping', 'Query\nCreation', 
              'Result\nSubmission']
gas_used = [300000, 27645, 182703, 148515]
colors = ['#3498db', '#9b59b6', '#e67e22', '#1abc9c']

bars = ax2.bar(operations, gas_used, color=colors, alpha=0.85)
ax2.set_ylabel('Gas Consumption (gas units)', fontweight='bold')
ax2.set_title('Gas Consumption by Transaction Type', fontweight='bold', pad=15)
ax2.grid(True, axis='y', alpha=0.3)
ax2.set_ylim(0, 350000)

# Add value labels on bars with offset
for bar in bars:
    height = bar.get_height()
    ax2.text(bar.get_x() + bar.get_width()/2., height + 8000,
            f'{int(height):,}',
            ha='center', va='bottom', fontweight='bold', fontsize=9)

plt.tight_layout()
plt.savefig(f'{output_dir}/fig_gas_consumption.pdf', dpi=300, bbox_inches='tight')
plt.savefig(f'{output_dir}/fig_gas_consumption.png', dpi=300, bbox_inches='tight')
plt.close()
print("    ✓ fig_gas_consumption.pdf/png")

# Figure 3: Byzantine Consensus Results
print("[3/5] Generating Byzantine consensus chart...")
fig3, ax3 = plt.subplots(figsize=(7, 4))
scenarios = ['Strong\nConsensus', 'Split\nVote', 'Byzantine\nAttack']
agreement_ratios = [71.4, 42.9, 57.1]
threshold = 66.0
colors_consensus = ['#27ae60', '#e74c3c', '#e67e22']

bars = ax3.bar(scenarios, agreement_ratios, color=colors_consensus, alpha=0.85)
ax3.axhline(y=threshold, color='red', linestyle='--', linewidth=2, label=f'Consensus Threshold ({threshold}%)')

ax3.set_ylabel('Agreement Ratio (%)', fontweight='bold')
ax3.set_title('Byzantine Fault Tolerance Test Results', fontweight='bold', pad=15)
ax3.legend(loc='upper right', frameon=True, shadow=True)
ax3.grid(True, axis='y', alpha=0.3)
ax3.set_ylim(0, 100)

# Add value labels with offset
for i, (bar, val) in enumerate(zip(bars, agreement_ratios)):
    height = bar.get_height()
    status = 'Pass' if val >= threshold or (i == 1 and val < threshold) else 'Expected'
    ax3.text(bar.get_x() + bar.get_width()/2., height + 4,
            f'{val:.1f}%\n{status}',
            ha='center', va='bottom', fontweight='bold', fontsize=9)

plt.tight_layout()
plt.savefig(f'{output_dir}/fig_byzantine_consensus.pdf', dpi=300, bbox_inches='tight')
plt.savefig(f'{output_dir}/fig_byzantine_consensus.png', dpi=300, bbox_inches='tight')
plt.close()
print("    ✓ fig_byzantine_consensus.pdf/png")

# Figure 4: Multi-Stage Verification Pipeline Performance
print("[4/5] Generating verification pipeline chart...")
fig4, (ax4a, ax4b) = plt.subplots(1, 2, figsize=(10, 4))

stages = ['Signature\nVerify', 'Hash\nVerify', 'Registry\nValidate', 
          'Reputation\nCheck', 'Content\nPolicy', 'Consensus\nAggregate', 'Proof\nAssembly']
exec_times = [24, 45, 38, 40, 59, 58, 59]
colors_stage = ['#3498db'] * len(stages)

bars = ax4a.barh(stages, exec_times, color=colors_stage, alpha=0.85)
ax4a.set_xlabel('Execution Time (ms)', fontweight='bold')
ax4a.set_title('Verification Pipeline Stage Performance', fontweight='bold', pad=15)
ax4a.grid(True, axis='x', alpha=0.3)

# Add value labels with offset
for i, (bar, time) in enumerate(zip(bars, exec_times)):
    width = bar.get_width()
    ax4a.text(width + 2, bar.get_y() + bar.get_height()/2.,
            f'{time}ms',
            ha='left', va='center', fontweight='bold', fontsize=8)

# Cumulative time plot
cumulative_times = np.cumsum(exec_times)
ax4b.plot(range(1, len(stages)+1), cumulative_times, 'o-', linewidth=2, 
          markersize=8, color='#e74c3c')
ax4b.fill_between(range(1, len(stages)+1), cumulative_times, alpha=0.3, color='#e74c3c')
ax4b.set_xlabel('Pipeline Stage', fontweight='bold')
ax4b.set_ylabel('Cumulative Time (ms)', fontweight='bold')
ax4b.set_title('Cumulative Verification Time', fontweight='bold', pad=15)
ax4b.grid(True, alpha=0.3)
ax4b.set_xticks(range(1, len(stages)+1))

# Add final time annotation
ax4b.annotate(f'Total: {sum(exec_times)}ms\nThroughput: 4.1/sec', 
             xy=(7, cumulative_times[-1]), xytext=(5, cumulative_times[-1] - 50),
             fontsize=9, bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7),
             arrowprops=dict(arrowstyle='->', lw=1.5))

plt.tight_layout()
plt.savefig(f'{output_dir}/fig_verification_pipeline.pdf', dpi=300, bbox_inches='tight')
plt.savefig(f'{output_dir}/fig_verification_pipeline.png', dpi=300, bbox_inches='tight')
plt.close()
print("    ✓ fig_verification_pipeline.pdf/png")

# Figure 5: Reputation Evolution Simulation
print("[5/5] Generating reputation evolution chart...")
fig5, ax5 = plt.subplots(figsize=(7, 4))
rounds = np.arange(1, 11)
reputation_scores = [55, 60, 65, 70, 75, 80, 75, 80, 75, 80]
success = [True, True, True, True, True, True, False, True, False, True]

colors_rep = ['#27ae60' if s else '#e74c3c' for s in success]
ax5.plot(rounds, reputation_scores, 'o-', linewidth=2, markersize=8, color='#2c3e50')

for i, (r, score, succ) in enumerate(zip(rounds, reputation_scores, success)):
    ax5.plot(r, score, 'o', markersize=10, color=colors_rep[i])

ax5.set_xlabel('Task Round', fontweight='bold')
ax5.set_ylabel('Reputation Score', fontweight='bold')
ax5.set_title('Node Reputation Evolution Over Task Rounds', fontweight='bold', pad=15)
ax5.grid(True, alpha=0.3)
ax5.set_xlim(0, 11)
ax5.set_ylim(50, 85)

# Legend
success_patch = mpatches.Patch(color='#27ae60', label='Task Success')
failure_patch = mpatches.Patch(color='#e74c3c', label='Task Failure')
ax5.legend(handles=[success_patch, failure_patch], loc='lower right', frameon=True, shadow=True)

plt.tight_layout()
plt.savefig(f'{output_dir}/fig_reputation_evolution.pdf', dpi=300, bbox_inches='tight')
plt.savefig(f'{output_dir}/fig_reputation_evolution.png', dpi=300, bbox_inches='tight')
plt.close()
print("    ✓ fig_reputation_evolution.pdf/png")

print("\n" + "="*60)
print("All figures generated successfully!")
print("="*60)
print(f"\nOutput directory: {os.path.abspath(output_dir)}")
print("\nGenerated files:")
print("  • fig_complexity_comparison.pdf/png")
print("  • fig_gas_consumption.pdf/png")
print("  • fig_byzantine_consensus.pdf/png")
print("  • fig_verification_pipeline.pdf/png")
print("  • fig_reputation_evolution.pdf/png")
print("\nYou can now use these figures in your LaTeX manuscript.")