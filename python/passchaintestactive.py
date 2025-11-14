"""
PAYS Framework Performance Visualization Script
Generates publication-quality graphs for IEEE Transactions manuscript
Based on real experimental data from Ethereum Sepolia and Polkadot Rococo testnets
"""

import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib.patches import Rectangle
import json
import os

# Create output directory if it doesn't exist
output_dir = "./outputs"
os.makedirs(output_dir, exist_ok=True)

# Set publication-quality style
plt.style.use('seaborn-v0_8-paper')
sns.set_palette("husl")
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 11
plt.rcParams['axes.labelsize'] = 12
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['xtick.labelsize'] = 10
plt.rcParams['ytick.labelsize'] = 10
plt.rcParams['legend.fontsize'] = 10
plt.rcParams['figure.titlesize'] = 16

# Experimental data from actual test runs
ethereum_data = {
    'speculative': [331, 321, 313, 1168, 389, 390],  # Including outlier from run 2
    'confirmable': [349, 316, 407, 386],
    'gas_price': 0.00100001  # Gwei
}

polkadot_data = {
    'speculative': [405, 412, 464, 416, 414, 415],
    'confirmable': [390, 412, 410, 412],
}

# Connection metrics
connection_times = {
    'Ethereum': 16.1,
    'Polkadot': 14.8,
    'Average': 15.45
}

# Cross-chain bridge latencies
bridge_latencies = [0, 0, 1]  # ms

# Baseline comparison data (from paper claims and industry standards)
baseline_metrics = {
    'Polkadot': {'connection': 28.7, 'accuracy': 85, 'cost': 1500000},
    'Cosmos': {'connection': 24.2, 'accuracy': 88, 'cost': 500000},
    'LayerZero': {'connection': 31.5, 'accuracy': 76.2, 'cost': 1682945},
    'PAYS': {'connection': 15.45, 'accuracy': 100, 'cost': 1028454}
}

def figure1_transaction_processing_comparison():
    """
    Figure 1: Transaction Processing Time Comparison
    Shows speculative vs confirmable transaction performance
    """
    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    
    # Ethereum subplot
    eth_spec = ethereum_data['speculative']
    eth_conf = ethereum_data['confirmable']
    
    positions1 = [1, 2]
    data1 = [eth_spec, eth_conf]
    
    bp1 = axes[0].boxplot(data1, positions=positions1, widths=0.6,
                           patch_artist=True, showmeans=True,
                           boxprops=dict(facecolor='lightblue', alpha=0.7),
                           medianprops=dict(color='red', linewidth=2),
                           meanprops=dict(marker='D', markerfacecolor='green', markersize=8))
    
    axes[0].set_xticks(positions1)
    axes[0].set_xticklabels(['Speculative\nTransactions', 'Confirmable\nTransactions'])
    axes[0].set_ylabel('Processing Time (ms)', fontsize=12)
    axes[0].set_title('(a) Ethereum Sepolia Transaction Processing', fontsize=13, fontweight='bold')
    axes[0].grid(True, alpha=0.3, linestyle='--')
    axes[0].set_ylim(0, 1300)
    
    # Add statistics text
    eth_spec_mean = np.mean(eth_spec)
    eth_conf_mean = np.mean(eth_conf)
    axes[0].text(1, 1200, f'Mean: {eth_spec_mean:.1f} ms', ha='center', fontsize=9, 
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    axes[0].text(2, 450, f'Mean: {eth_conf_mean:.1f} ms', ha='center', fontsize=9,
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    # Polkadot subplot
    dot_spec = polkadot_data['speculative']
    dot_conf = polkadot_data['confirmable']
    
    positions2 = [1, 2]
    data2 = [dot_spec, dot_conf]
    
    bp2 = axes[1].boxplot(data2, positions=positions2, widths=0.6,
                           patch_artist=True, showmeans=True,
                           boxprops=dict(facecolor='lightcoral', alpha=0.7),
                           medianprops=dict(color='darkblue', linewidth=2),
                           meanprops=dict(marker='D', markerfacecolor='green', markersize=8))
    
    axes[1].set_xticks(positions2)
    axes[1].set_xticklabels(['Speculative\nTransactions', 'Confirmable\nTransactions'])
    axes[1].set_ylabel('Processing Time (ms)', fontsize=12)
    axes[1].set_title('(b) Polkadot Rococo Transaction Processing', fontsize=13, fontweight='bold')
    axes[1].grid(True, alpha=0.3, linestyle='--')
    axes[1].set_ylim(0, 500)
    
    # Add statistics text
    dot_spec_mean = np.mean(dot_spec)
    dot_conf_mean = np.mean(dot_conf)
    axes[1].text(1, 470, f'Mean: {dot_spec_mean:.1f} ms', ha='center', fontsize=9,
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    axes[1].text(2, 440, f'Mean: {dot_conf_mean:.1f} ms', ha='center', fontsize=9,
                bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/figure1_transaction_processing.pdf', dpi=300, bbox_inches='tight')
    plt.savefig(f'{output_dir}/figure1_transaction_processing.png', dpi=300, bbox_inches='tight')
    print("✓ Figure 1 generated: Transaction Processing Comparison")
    return fig

def figure2_connection_time_comparison():
    """
    Figure 2: Connection Time Comparison across Blockchains
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    
    blockchains = list(connection_times.keys())
    times = list(connection_times.values())
    colors = ['#3498db', '#e74c3c', '#2ecc71']
    
    bars = ax.bar(blockchains, times, color=colors, alpha=0.8, edgecolor='black', linewidth=1.5)
    
    # Add target line
    ax.axhline(y=20, color='red', linestyle='--', linewidth=2, label='Target: 20 ms')
    
    # Add value labels on bars
    for bar, time in zip(bars, times):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 0.5,
                f'{time:.2f} ms', ha='center', va='bottom', fontsize=11, fontweight='bold')
    
    ax.set_ylabel('Connection Time (ms)', fontsize=13)
    ax.set_xlabel('Blockchain Network', fontsize=13)
    ax.set_title('Connection Time Performance Across Blockchain Networks', 
                fontsize=14, fontweight='bold', pad=20)
    ax.set_ylim(0, 25)
    ax.legend(loc='upper right', fontsize=11)
    ax.grid(True, alpha=0.3, axis='y', linestyle='--')
    
    # Add achievement badge
    ax.text(0.98, 0.95, '✓ Target\nAchieved', transform=ax.transAxes,
            fontsize=12, verticalalignment='top', horizontalalignment='right',
            bbox=dict(boxstyle='round', facecolor='lightgreen', alpha=0.7))
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/figure2_connection_times.pdf', dpi=300, bbox_inches='tight')
    plt.savefig(f'{output_dir}/figure2_connection_times.png', dpi=300, bbox_inches='tight')
    print("✓ Figure 2 generated: Connection Time Comparison")
    return fig

def figure3_baseline_comparison():
    """
    Figure 3: PAYS vs Baseline Cross-Chain Solutions
    Multi-metric comparison radar/bar chart
    """
    fig, axes = plt.subplots(1, 3, figsize=(16, 5))
    
    solutions = list(baseline_metrics.keys())
    
    # Connection time comparison
    connection_data = [baseline_metrics[sol]['connection'] for sol in solutions]
    colors_conn = ['#e74c3c' if sol != 'PAYS' else '#2ecc71' for sol in solutions]
    
    bars1 = axes[0].bar(solutions, connection_data, color=colors_conn, alpha=0.8, 
                       edgecolor='black', linewidth=1.5)
    axes[0].set_ylabel('Connection Time (ms)', fontsize=12)
    axes[0].set_title('(a) Connection Time Comparison', fontsize=12, fontweight='bold')
    axes[0].grid(True, alpha=0.3, axis='y')
    axes[0].tick_params(axis='x', rotation=45)
    
    for bar, val in zip(bars1, connection_data):
        height = bar.get_height()
        axes[0].text(bar.get_x() + bar.get_width()/2., height + 1,
                    f'{val:.1f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    # Accuracy comparison
    accuracy_data = [baseline_metrics[sol]['accuracy'] for sol in solutions]
    colors_acc = ['#e74c3c' if sol != 'PAYS' else '#2ecc71' for sol in solutions]
    
    bars2 = axes[1].bar(solutions, accuracy_data, color=colors_acc, alpha=0.8,
                       edgecolor='black', linewidth=1.5)
    axes[1].set_ylabel('Accuracy (%)', fontsize=12)
    axes[1].set_title('(b) Transaction Accuracy Comparison', fontsize=12, fontweight='bold')
    axes[1].grid(True, alpha=0.3, axis='y')
    axes[1].tick_params(axis='x', rotation=45)
    axes[1].set_ylim(70, 105)
    
    # Add 90% target line
    axes[1].axhline(y=90, color='blue', linestyle='--', linewidth=1.5, alpha=0.7, label='Target: 90%')
    axes[1].legend(fontsize=9)
    
    for bar, val in zip(bars2, accuracy_data):
        height = bar.get_height()
        axes[1].text(bar.get_x() + bar.get_width()/2., height + 0.5,
                    f'{val:.1f}%', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    # Cost comparison (normalized)
    cost_data = [baseline_metrics[sol]['cost'] / 1000000 for sol in solutions]  # Convert to millions
    colors_cost = ['#e74c3c' if sol != 'PAYS' else '#2ecc71' for sol in solutions]
    
    bars3 = axes[2].bar(solutions, cost_data, color=colors_cost, alpha=0.8,
                       edgecolor='black', linewidth=1.5)
    axes[2].set_ylabel('Network Cost (Million Wei)', fontsize=12)
    axes[2].set_title('(c) Network Cost Comparison', fontsize=12, fontweight='bold')
    axes[2].grid(True, alpha=0.3, axis='y')
    axes[2].tick_params(axis='x', rotation=45)
    
    for bar, val, sol in zip(bars3, cost_data, solutions):
        height = bar.get_height()
        axes[2].text(bar.get_x() + bar.get_width()/2., height + 0.05,
                    f'{val:.2f}M', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/figure3_baseline_comparison.pdf', dpi=300, bbox_inches='tight')
    plt.savefig(f'{output_dir}/figure3_baseline_comparison.png', dpi=300, bbox_inches='tight')
    print("✓ Figure 3 generated: Baseline Comparison")
    return fig

def figure4_threat_model_analysis():
    """
    Figure 4: Threat Model Severity and Likelihood Heatmap
    """
    fig, ax = plt.subplots(figsize=(10, 7))
    
    threats = ['XMEV-001\nCross-Chain MEV', 
               'BTA-002\nBridge Timing',
               'VRM-003\nValidator Reputation',
               'CSM-004\nConfidence Sybil',
               'COMP-005\nComponent Composition',
               'ASYNC-006\nAsync Desynch']
    
    severity_map = {'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0}
    likelihood_map = {'HIGH': 3, 'MEDIUM-HIGH': 2.5, 'MEDIUM': 2, 'LOW': 1}
    
    severities = [3, 3, 2, 2, 3, 2]  # CRITICAL=3, HIGH=2
    likelihoods = [3, 2, 2, 2.5, 2, 2]  # HIGH=3, MEDIUM-HIGH=2.5, MEDIUM=2
    
    # Create risk matrix
    risk_scores = [s * l for s, l in zip(severities, likelihoods)]
    
    # Create heatmap data
    heatmap_data = np.array([[severities[i], likelihoods[i], risk_scores[i]] 
                             for i in range(len(threats))])
    
    # Plot
    threat_labels = [t.split('\n')[0] for t in threats]
    categories = ['Severity', 'Likelihood', 'Risk Score']
    
    im = ax.imshow(heatmap_data.T, cmap='YlOrRd', aspect='auto', vmin=0, vmax=9)
    
    ax.set_xticks(np.arange(len(threats)))
    ax.set_yticks(np.arange(len(categories)))
    ax.set_xticklabels(threat_labels, rotation=45, ha='right')
    ax.set_yticklabels(categories)
    
    # Add colorbar
    cbar = plt.colorbar(im, ax=ax)
    cbar.set_label('Threat Score', rotation=270, labelpad=20)
    
    # Add text annotations
    for i in range(len(threats)):
        for j in range(len(categories)):
            text = ax.text(i, j, f'{heatmap_data[i, j]:.1f}',
                          ha="center", va="center", color="black", fontweight='bold')
    
    ax.set_title('Threat Model Security Analysis Matrix', fontsize=14, fontweight='bold', pad=20)
    plt.tight_layout()
    plt.savefig(f'{output_dir}/figure4_threat_analysis.pdf', dpi=300, bbox_inches='tight')
    plt.savefig(f'{output_dir}/figure4_threat_analysis.png', dpi=300, bbox_inches='tight')
    print("✓ Figure 4 generated: Threat Model Analysis")
    return fig

def figure5_performance_distribution():
    """
    Figure 5: Transaction Processing Time Distribution
    """
    fig, axes = plt.subplots(2, 2, figsize=(14, 10))
    
    all_eth = ethereum_data['speculative'] + ethereum_data['confirmable']
    all_dot = polkadot_data['speculative'] + polkadot_data['confirmable']
    
    # Ethereum histogram
    axes[0, 0].hist(all_eth, bins=15, color='#3498db', alpha=0.7, edgecolor='black')
    axes[0, 0].axvline(np.mean(all_eth), color='red', linestyle='--', linewidth=2, 
                      label=f'Mean: {np.mean(all_eth):.1f} ms')
    axes[0, 0].axvline(np.median(all_eth), color='green', linestyle='--', linewidth=2,
                      label=f'Median: {np.median(all_eth):.1f} ms')
    axes[0, 0].set_xlabel('Processing Time (ms)')
    axes[0, 0].set_ylabel('Frequency')
    axes[0, 0].set_title('(a) Ethereum Transaction Time Distribution', fontweight='bold')
    axes[0, 0].legend()
    axes[0, 0].grid(True, alpha=0.3)
    
    # Polkadot histogram
    axes[0, 1].hist(all_dot, bins=10, color='#e74c3c', alpha=0.7, edgecolor='black')
    axes[0, 1].axvline(np.mean(all_dot), color='red', linestyle='--', linewidth=2,
                      label=f'Mean: {np.mean(all_dot):.1f} ms')
    axes[0, 1].axvline(np.median(all_dot), color='green', linestyle='--', linewidth=2,
                      label=f'Median: {np.median(all_dot):.1f} ms')
    axes[0, 1].set_xlabel('Processing Time (ms)')
    axes[0, 1].set_ylabel('Frequency')
    axes[0, 1].set_title('(b) Polkadot Transaction Time Distribution', fontweight='bold')
    axes[0, 1].legend()
    axes[0, 1].grid(True, alpha=0.3)
    
    # Combined comparison violin plot
    combined_data = [all_eth, all_dot]
    parts = axes[1, 0].violinplot(combined_data, positions=[1, 2], showmeans=True, showmedians=True)
    axes[1, 0].set_xticks([1, 2])
    axes[1, 0].set_xticklabels(['Ethereum', 'Polkadot'])
    axes[1, 0].set_ylabel('Processing Time (ms)')
    axes[1, 0].set_title('(c) Comparative Distribution Analysis', fontweight='bold')
    axes[1, 0].grid(True, alpha=0.3, axis='y')
    
    # Bridge latency
    axes[1, 1].bar(['Bridge 1', 'Bridge 2', 'Bridge 3'], bridge_latencies, 
                  color='#2ecc71', alpha=0.8, edgecolor='black', linewidth=1.5)
    axes[1, 1].axhline(y=np.mean(bridge_latencies), color='red', linestyle='--', linewidth=2,
                      label=f'Mean: {np.mean(bridge_latencies):.2f} ms')
    axes[1, 1].set_ylabel('Latency (ms)')
    axes[1, 1].set_title('(d) Cross-Chain Bridge Latency', fontweight='bold')
    axes[1, 1].legend()
    axes[1, 1].grid(True, alpha=0.3, axis='y')
    axes[1, 1].set_ylim(0, 2)
    
    plt.tight_layout()
    plt.savefig(f'{output_dir}/figure5_performance_distribution.pdf', dpi=300, bbox_inches='tight')
    plt.savefig(f'{output_dir}/figure5_performance_distribution.png', dpi=300, bbox_inches='tight')
    print("✓ Figure 5 generated: Performance Distribution")
    return fig

def generate_all_figures():
    """
    Generate all publication figures
    """
    print("\n" + "="*70)
    print("PAYS Framework - Generating Publication Figures")
    print("="*70 + "\n")
    
    figure1_transaction_processing_comparison()
    figure2_connection_time_comparison()
    figure3_baseline_comparison()
    figure4_threat_model_analysis()
    figure5_performance_distribution()
    
    print("\n" + "="*70)
    print("✓ All figures generated successfully!")
    print(f"Output directory: {output_dir}/")
    print("="*70 + "\n")
    
    # Generate summary statistics
    print("\nSummary Statistics:")
    print("-" * 50)
    print(f"Ethereum Transactions: {len(all_eth)} total")
    print(f"  Mean: {np.mean(all_eth):.2f} ms, StdDev: {np.std(all_eth):.2f} ms")
    print(f"Polkadot Transactions: {len(all_dot)} total")
    print(f"  Mean: {np.mean(all_dot):.2f} ms, StdDev: {np.std(all_dot):.2f} ms")
    print(f"Bridge Latency: {np.mean(bridge_latencies):.2f} ms average")
    print(f"Connection Time: {connection_times['Average']:.2f} ms average")
    print("-" * 50)

# Calculate combined data for summary
all_eth = ethereum_data['speculative'] + ethereum_data['confirmable']
all_dot = polkadot_data['speculative'] + polkadot_data['confirmable']

if __name__ == "__main__":
    generate_all_figures()