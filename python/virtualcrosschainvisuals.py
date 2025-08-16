import matplotlib.pyplot as plt
import numpy as np
import os
import seaborn as sns

# Set clean academic style
plt.rcParams.update({
    'font.family': 'serif',
    'font.size': 11,
    'axes.linewidth': 0.8,
    'axes.spines.top': False,
    'axes.spines.right': False,
    'axes.grid': True,
    'grid.alpha': 0.3,
    'figure.facecolor': 'white',
    'axes.facecolor': 'white'
})

# Create directory for saving images
output_dir = "ethereum_analysis_charts"
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# Define academic color palette (muted, professional)
academic_blue = '#2E5077'
academic_red = '#D64545' 
academic_green = '#4A7C59'
academic_orange = '#D97706'
academic_purple = '#7C3AED'
academic_gray = '#64748B'

# =============================================
# Chart 1: Network TPS Comparison
# =============================================

fig, ax = plt.subplots(figsize=(10, 6))

networks = ['Mainnet', 'Sepolia']
tps_values = [16.3, 3.1]

bars = ax.bar(networks, tps_values, color=[academic_blue, academic_red], 
              alpha=0.7, edgecolor='none')

ax.set_ylabel('Transactions per Second (TPS)')
ax.set_title('Network Transaction Throughput Comparison', fontweight='bold', pad=15)
ax.set_ylim(0, max(tps_values) * 1.2)

# Add value labels
for bar, value in zip(bars, tps_values):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.3,
            f'{value}', ha='center', va='bottom', fontweight='bold')

plt.tight_layout()
plt.savefig(f'{output_dir}/01_network_tps_comparison.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 2: Active Addresses Comparison
# =============================================

fig, ax = plt.subplots(figsize=(10, 6))

active_addresses = [600000, 14000]

bars = ax.bar(networks, active_addresses, color=[academic_green, academic_orange], 
              alpha=0.7, edgecolor='none')

ax.set_ylabel('Active Addresses (Past 24h)')
ax.set_title('Daily Active Addresses Comparison', fontweight='bold', pad=15)

# Format y-axis to show values in thousands
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000:.0f}K'))

# Add value labels
for bar, value in zip(bars, active_addresses):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 10000,
            f'{value/1000:.0f}K', ha='center', va='bottom', fontweight='bold')

plt.tight_layout()
plt.savefig(f'{output_dir}/02_active_addresses_comparison.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 3: Gas Price Comparison
# =============================================

fig, ax = plt.subplots(figsize=(10, 6))

gas_prices = [11.5, 5.0]

bars = ax.bar(networks, gas_prices, color=[academic_purple, academic_gray], 
              alpha=0.7, edgecolor='none')

ax.set_ylabel('Gas Price (Gwei)')
ax.set_title('Network Gas Price Comparison', fontweight='bold', pad=15)

# Add value labels
for bar, value in zip(bars, gas_prices):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.2,
            f'{value}', ha='center', va='bottom', fontweight='bold')

plt.tight_layout()
plt.savefig(f'{output_dir}/03_gas_price_comparison.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 4: Major Operations Gas Cost
# =============================================

fig, ax = plt.subplots(figsize=(12, 7))

operations = ['Data Validation', 'DVRCChain', 'Merkle Root\nCommitment', 
              'Virtual Machine\nTable', 'Node Selection', 'Oracle\nConfiguration']
gas_costs = [495647, 1776485, 244012, 888986, 663016, 891018]

# Use a single muted color for academic look
bars = ax.bar(operations, gas_costs, color=academic_blue, alpha=0.7, edgecolor='none')

ax.set_ylabel('Gas Cost (Wei)')
ax.set_title('Gas Cost for Major Operations', fontweight='bold', pad=15)
ax.tick_params(axis='x', rotation=45)

# Format y-axis for readability
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000:.0f}K'))

# Add value labels
for bar, value in zip(bars, gas_costs):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 20000,
            f'{value:,}', ha='center', va='bottom', fontsize=9, rotation=45)

plt.tight_layout()
plt.savefig(f'{output_dir}/04_major_operations_gas_cost.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 5: Internal Operations Gas Cost
# =============================================

fig, ax = plt.subplots(figsize=(12, 7))

internal_ops = ['Commit Data', 'Round Robin\nSelection', 'Node Addition', 
                'Add Oracle Data', 'Setting Fee Per\nTransmission', 'Role Permission']
internal_gas = [24254, 28768, 111274, 68464, 46160, 24688]

bars = ax.bar(internal_ops, internal_gas, color=academic_green, alpha=0.7, edgecolor='none')

ax.set_ylabel('Gas Cost (Wei)')
ax.set_title('Gas Cost for Internal Operations', fontweight='bold', pad=15)
ax.tick_params(axis='x', rotation=45)

# Add value labels
for bar, value in zip(bars, internal_gas):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 2000,
            f'{value:,}', ha='center', va='bottom', fontsize=9)

plt.tight_layout()
plt.savefig(f'{output_dir}/05_internal_operations_gas_cost.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 6: Block Height Analysis
# =============================================

fig, ax = plt.subplots(figsize=(12, 7))

block_operations = ['Data Validation', 'DVRCChain', 'Merkle Root\nCommitment', 
                   'Virtual Machine\nTable', 'Node Selection', 'Oracle\nConfiguration']
block_heights = [4848837, 4911910, 4842542, 4849076, 4840715, 4841003]

bars = ax.bar(block_operations, block_heights, color=academic_red, alpha=0.7, edgecolor='none')

ax.set_ylabel('Block Height')
ax.set_title('Block Height for Major Operations', fontweight='bold', pad=15)
ax.tick_params(axis='x', rotation=45)

# Format y-axis
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'{x/1000000:.1f}M'))

# Add value labels
for bar, value in zip(bars, block_heights):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 5000,
            f'{value:,}', ha='center', va='bottom', fontsize=9, rotation=45)

plt.tight_layout()
plt.savefig(f'{output_dir}/06_block_height_analysis.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 7: Network Hash Rate Comparison
# =============================================

fig, ax = plt.subplots(figsize=(10, 6))

hash_rates = [816, 83]  # Petahash/s

bars = ax.bar(networks, hash_rates, color=[academic_orange, academic_purple], 
              alpha=0.7, edgecolor='none')

ax.set_ylabel('Network Hash Rate (Petahash/s)')
ax.set_title('Network Hash Rate Comparison', fontweight='bold', pad=15)

# Add value labels
for bar, value in zip(bars, hash_rates):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 15,
            f'{value}', ha='center', va='bottom', fontweight='bold')

plt.tight_layout()
plt.savefig(f'{output_dir}/07_hash_rate_comparison.pdf', dpi=300, bbox_inches='tight')
plt.close()

# =============================================
# Chart 8: Transaction Fee Comparison
# =============================================

fig, ax = plt.subplots(figsize=(10, 6))

tx_fees = [0.0021, 0.0008]  # ETH

bars = ax.bar(networks, tx_fees, color=[academic_gray, academic_green], 
              alpha=0.7, edgecolor='none')

ax.set_ylabel('Median Transaction Fee (ETH)')
ax.set_title('Network Transaction Fee Comparison', fontweight='bold', pad=15)

# Add value labels
for bar, value in zip(bars, tx_fees):
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.0001,
            f'{value:.4f}', ha='center', va='bottom', fontweight='bold')

plt.tight_layout()
plt.savefig(f'{output_dir}/08_transaction_fee_comparison.pdf', dpi=300, bbox_inches='tight')
plt.close()

print(f"All charts have been successfully created and saved in the '{output_dir}' directory!")
print(f"Generated 8 clean, academic-style charts:")
print("1. Network TPS Comparison")
print("2. Active Addresses Comparison")
print("3. Gas Price Comparison")
print("4. Major Operations Gas Cost")
print("5. Internal Operations Gas Cost")
print("6. Block Height Analysis")
print("7. Network Hash Rate Comparison")
print("8. Transaction Fee Comparison")