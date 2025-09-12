import matplotlib.pyplot as plt
import numpy as np
import matplotlib.patches as mpatches

# Set the style for publication-quality figures
plt.style.use('seaborn-v0_8-paper')
plt.rcParams['font.size'] = 11
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman']
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['xtick.labelsize'] = 10
plt.rcParams['ytick.labelsize'] = 10
plt.rcParams['legend.fontsize'] = 10
plt.rcParams['figure.figsize'] = (12, 8)

# Create figure with subplots
fig, axes = plt.subplots(2, 3, figsize=(14, 8))
fig.suptitle('Performance Comparison: RekShare vs BlockSOP', fontsize=14, fontweight='bold')

# Data for comparison
categories = ['Response\nTime (ms)', 'Gas Cost\n(ETH)', 'Success\nRate (%)', 
              'Throughput\n(TPS)', 'Failed\nTx Rate (%)', 'Scalability\n(nodes)']

# Subplot 1: Response Time
ax1 = axes[0, 0]
response_times = [107.2, 122.8]
systems = ['RekShare', 'BlockSOP']
colors = ['#2E86AB', '#A23B72']
bars1 = ax1.bar(systems, response_times, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax1.set_ylabel('Response Time (ms)', fontweight='bold')
ax1.set_title('(a) Response Time Comparison')
ax1.set_ylim(0, 150)
for bar, value in zip(bars1, response_times):
    ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 2, 
             f'{value:.1f}', ha='center', va='bottom', fontweight='bold')

# Subplot 2: Gas Cost
ax2 = axes[0, 1]
gas_costs = [0.00043, 0.00052]  # Using lower bound for BlockSOP
bars2 = ax2.bar(systems, gas_costs, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax2.set_ylabel('Gas Cost (ETH)', fontweight='bold')
ax2.set_title('(b) Transaction Gas Cost')
ax2.set_ylim(0, 0.0007)
for bar, value in zip(bars2, gas_costs):
    ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.00002, 
             f'{value:.5f}', ha='center', va='bottom', fontweight='bold')

# Subplot 3: Success Rate
ax3 = axes[0, 2]
success_rates = [100, 99.5]  # Using average for BlockSOP
bars3 = ax3.bar(systems, success_rates, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax3.set_ylabel('Success Rate (%)', fontweight='bold')
ax3.set_title('(c) Transaction Success Rate')
ax3.set_ylim(95, 101)
for bar, value in zip(bars3, success_rates):
    ax3.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1, 
             f'{value:.1f}%', ha='center', va='bottom', fontweight='bold')

# Subplot 4: Throughput
ax4 = axes[1, 0]
throughput = [905.73, 493.68]
bars4 = ax4.bar(systems, throughput, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax4.set_ylabel('Throughput (TPS)', fontweight='bold')
ax4.set_title('(d) Write Throughput Performance')
ax4.set_ylim(0, 1000)
for bar, value in zip(bars4, throughput):
    ax4.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 10, 
             f'{value:.1f}', ha='center', va='bottom', fontweight='bold')

# Subplot 5: Failed Transaction Rate
ax5 = axes[1, 1]
failed_rates = [0.15, 61.4]  # Percentage of failed transactions
bars5 = ax5.bar(systems, failed_rates, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
ax5.set_ylabel('Failed Transaction Rate (%)', fontweight='bold')
ax5.set_title('(e) Transaction Failure Rate')
ax5.set_ylim(0, 70)
for bar, value in zip(bars5, failed_rates):
    ax5.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1, 
             f'{value:.2f}%', ha='center', va='bottom', fontweight='bold')

# Subplot 6: Overall Performance Index (Normalized)
ax6 = axes[1, 2]
# Normalize metrics (higher is better)
# For RekShare: normalize each metric to 0-100 scale where RekShare = 100 for best metrics
metrics_rekshare = [100, 100, 100, 100, 100]  # Normalized values
metrics_blocksop = [87.3, 82.7, 99.5, 54.5, 0.24]  # Relative to RekShare

x = np.arange(len(['RT', 'GC', 'SR', 'TP', 'FR']))
width = 0.35

bars_r = ax6.bar(x - width/2, metrics_rekshare, width, label='RekShare', 
                 color=colors[0], alpha=0.8, edgecolor='black', linewidth=1.5)
bars_b = ax6.bar(x + width/2, metrics_blocksop, width, label='BlockSOP', 
                 color=colors[1], alpha=0.8, edgecolor='black', linewidth=1.5)

ax6.set_ylabel('Normalized Performance (%)', fontweight='bold')
ax6.set_title('(f) Overall Performance Index')
ax6.set_xticks(x)
ax6.set_xticklabels(['RT', 'GC', 'SR', 'TP', 'FR'])
ax6.legend(loc='upper right')
ax6.set_ylim(0, 120)

# Add grid to all subplots
for ax in axes.flat:
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)

# Adjust layout
plt.tight_layout()
plt.subplots_adjust(top=0.93)

# Save figure
plt.savefig('performance_comparison.pdf', dpi=300, bbox_inches='tight')
plt.savefig('performance_comparison.png', dpi=300, bbox_inches='tight')
plt.show()

# Print improvement percentages
print("Performance Improvements (RekShare vs BlockSOP):")
print(f"Response Time: {((122.8-107.2)/122.8)*100:.1f}% faster")
print(f"Gas Cost: {((0.00052-0.00043)/0.00052)*100:.1f}% lower")
print(f"Throughput: {((905.73-493.68)/493.68)*100:.1f}% higher")
print(f"Failure Rate: {((61.4-0.15)/61.4)*100:.1f}% reduction")