import matplotlib.pyplot as plt
import numpy as np

# Data
session_sizes = ['2-participant', '4-participant', '6-participant', 
                 '8-participant', '10-participant']
successful = [11, 19, 28, 39, 73]
amount_mismatches = [6, 8, 11, 18, 28]
commitment_violations = [3, 11, 9, 15, 34]

# X-axis positions
x = np.arange(len(session_sizes))
width = 0.25  # Width of bars

# Create figure with academic styling
fig, ax = plt.subplots(figsize=(12, 7), dpi=300)

# Create grouped bar chart
bars1 = ax.bar(x - width, successful, width, label='Successful',
               color='#2E7D32', edgecolor='black', linewidth=1.2, alpha=0.85)
bars2 = ax.bar(x, amount_mismatches, width, label='Amount Mismatches',
               color='#F57C00', edgecolor='black', linewidth=1.2, alpha=0.85)
bars3 = ax.bar(x + width, commitment_violations, width, label='Commitment Violations',
               color='#C62828', edgecolor='black', linewidth=1.2, alpha=0.85)

# Customize the plot
ax.set_xlabel('Session Size', fontsize=14, fontweight='bold')
ax.set_ylabel('Number of Transactions', fontsize=14, fontweight='bold')
ax.set_title('Transaction Statistics by Session Size', 
             fontsize=16, fontweight='bold', pad=20)

# Set x-axis labels
ax.set_xticks(x)
ax.set_xticklabels(session_sizes, fontsize=11)
ax.tick_params(axis='y', labelsize=12)

# Add legend
ax.legend(loc='upper left', fontsize=12, framealpha=0.95, edgecolor='black')

# Add grid for better readability
ax.grid(axis='y', alpha=0.3, linestyle='--', linewidth=0.7, zorder=0)
ax.set_axisbelow(True)

# Add value labels on top of bars
def add_value_labels(bars):
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(height)}',
                ha='center', va='bottom', fontsize=9, fontweight='bold')

add_value_labels(bars1)
add_value_labels(bars2)
add_value_labels(bars3)

# Adjust layout
plt.tight_layout()

# Save figures
plt.savefig('transaction_statistics.png', dpi=300, bbox_inches='tight')
plt.savefig('transaction_statistics.pdf', bbox_inches='tight')

print("Grouped bar chart saved as:")
print("- transaction_statistics.png")
print("- transaction_statistics.pdf")

plt.show()

# Create stacked bar chart version
fig, ax = plt.subplots(figsize=(12, 7), dpi=300)

bars1 = ax.bar(x, successful, width*2, label='Successful',
               color='#2E7D32', edgecolor='black', linewidth=1.2, alpha=0.85)
bars2 = ax.bar(x, amount_mismatches, width*2, bottom=successful,
               label='Amount Mismatches', color='#F57C00', 
               edgecolor='black', linewidth=1.2, alpha=0.85)
bars3 = ax.bar(x, commitment_violations, width*2,
               bottom=np.array(successful) + np.array(amount_mismatches),
               label='Commitment Violations', color='#C62828',
               edgecolor='black', linewidth=1.2, alpha=0.85)

ax.set_xlabel('Session Size', fontsize=14, fontweight='bold')
ax.set_ylabel('Number of Transactions', fontsize=14, fontweight='bold')
ax.set_title('Cumulative Transaction Statistics by Session Size', 
             fontsize=16, fontweight='bold', pad=20)

ax.set_xticks(x)
ax.set_xticklabels(session_sizes, fontsize=11)
ax.tick_params(axis='y', labelsize=12)

ax.legend(loc='upper left', fontsize=12, framealpha=0.95, edgecolor='black')
ax.grid(axis='y', alpha=0.3, linestyle='--', linewidth=0.7, zorder=0)
ax.set_axisbelow(True)

plt.tight_layout()

plt.savefig('transaction_statistics_stacked.png', dpi=300, bbox_inches='tight')
plt.savefig('transaction_statistics_stacked.pdf', bbox_inches='tight')

print("\nStacked bar chart saved as:")
print("- transaction_statistics_stacked.png")
print("- transaction_statistics_stacked.pdf")

plt.show()

# Create line plot version for trend analysis
fig, ax = plt.subplots(figsize=(12, 7), dpi=300)

participant_numbers = [2, 4, 6, 8, 10]

ax.plot(participant_numbers, successful, marker='o', linewidth=2.5,
        markersize=10, label='Successful', color='#2E7D32',
        markerfacecolor='white', markeredgewidth=2.5, markeredgecolor='#2E7D32')

ax.plot(participant_numbers, amount_mismatches, marker='s', linewidth=2.5,
        markersize=10, label='Amount Mismatches', color='#F57C00',
        markerfacecolor='white', markeredgewidth=2.5, markeredgecolor='#F57C00')

ax.plot(participant_numbers, commitment_violations, marker='^', linewidth=2.5,
        markersize=10, label='Commitment Violations', color='#C62828',
        markerfacecolor='white', markeredgewidth=2.5, markeredgecolor='#C62828')

ax.set_xlabel('Number of Participants', fontsize=14, fontweight='bold')
ax.set_ylabel('Number of Transactions', fontsize=14, fontweight='bold')
ax.set_title('Transaction Trends Across Session Sizes', 
             fontsize=16, fontweight='bold', pad=20)

ax.set_xticks(participant_numbers)
ax.tick_params(axis='both', labelsize=12)

ax.legend(loc='upper left', fontsize=12, framealpha=0.95, edgecolor='black')
ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.7)

plt.tight_layout()

plt.savefig('transaction_statistics_line.png', dpi=300, bbox_inches='tight')
plt.savefig('transaction_statistics_line.pdf', bbox_inches='tight')

print("\nLine plot saved as:")
print("- transaction_statistics_line.png")
print("- transaction_statistics_line.pdf")

plt.show()

# Print summary statistics
print("\n" + "="*60)
print("SUMMARY STATISTICS")
print("="*60)
total_transactions = np.array(successful) + np.array(amount_mismatches) + np.array(commitment_violations)
success_rate = (np.array(successful) / total_transactions * 100).round(2)

for i, size in enumerate(session_sizes):
    print(f"\n{size}:")
    print(f"  Total Transactions: {total_transactions[i]}")
    print(f"  Success Rate: {success_rate[i]}%")
    print(f"  Successful: {successful[i]}")
    print(f"  Amount Mismatches: {amount_mismatches[i]}")
    print(f"  Commitment Violations: {commitment_violations[i]}")