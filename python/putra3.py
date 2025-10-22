import matplotlib.pyplot as plt
import numpy as np

# Set modern style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica']

# Data
session_sizes = ['2-participant', '4-participant', '6-participant', 
                 '8-participant', '10-participant']
successful = [11, 19, 28, 39, 73]
amount_mismatches = [6, 8, 11, 18, 28]
commitment_violations = [3, 11, 9, 15, 34]

# X-axis positions
x = np.arange(len(session_sizes))
width = 0.25

# Create figure with modern styling
fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

# Remove spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#CCCCCC')
ax.spines['bottom'].set_color('#CCCCCC')

# Create grouped bar chart without borders
bars1 = ax.bar(x - width, successful, width, label='Successful',
               color='#52B788', edgecolor='none', alpha=0.9)
bars2 = ax.bar(x, amount_mismatches, width, label='Amount Mismatches',
               color='#FF9F1C', edgecolor='none', alpha=0.9)
bars3 = ax.bar(x + width, commitment_violations, width, label='Commitment Violations',
               color='#E63946', edgecolor='none', alpha=0.9)

# Customize the plot
ax.set_xlabel('Session Size', fontsize=13, color='#333333')
ax.set_ylabel('Transaction Count', fontsize=13, color='#333333')
ax.set_title('Transaction Statistics by Session Size', 
             fontsize=15, color='#333333', pad=20, loc='left')

# Set x-axis labels
ax.set_xticks(x)
ax.set_xticklabels(session_sizes, fontsize=10, color='#666666')
ax.tick_params(axis='both', colors='#666666', length=0)

# Add legend with modern styling
ax.legend(loc='upper left', fontsize=11, frameon=True, 
          facecolor='white', edgecolor='#CCCCCC', framealpha=0.9)

# Subtle grid
ax.grid(axis='y', alpha=0.2, linestyle='-', linewidth=1, color='#CCCCCC')
ax.set_axisbelow(True)

# Add value labels
def add_value_labels(bars):
    for bar in bars:
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                f'{int(height)}',
                ha='center', va='bottom', fontsize=9, color='#333333')

add_value_labels(bars1)
add_value_labels(bars2)
add_value_labels(bars3)

# Set background
fig.patch.set_facecolor('white')
ax.set_facecolor('#FAFAFA')

plt.tight_layout()

plt.savefig('transaction_statistics.png', dpi=300, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.savefig('transaction_statistics.pdf', bbox_inches='tight',
            facecolor='white', edgecolor='none')

print("Modern grouped bar chart saved as:")
print("- transaction_statistics.png")
print("- transaction_statistics.pdf")

plt.show()

# Create stacked bar chart with modern styling
fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#CCCCCC')
ax.spines['bottom'].set_color('#CCCCCC')

bars1 = ax.bar(x, successful, width*2, label='Successful',
               color='#52B788', edgecolor='none', alpha=0.9)
bars2 = ax.bar(x, amount_mismatches, width*2, bottom=successful,
               label='Amount Mismatches', color='#FF9F1C', 
               edgecolor='none', alpha=0.9)
bars3 = ax.bar(x, commitment_violations, width*2,
               bottom=np.array(successful) + np.array(amount_mismatches),
               label='Commitment Violations', color='#E63946',
               edgecolor='none', alpha=0.9)

ax.set_xlabel('Session Size', fontsize=13, color='#333333')
ax.set_ylabel('Transaction Count', fontsize=13, color='#333333')
ax.set_title('Cumulative Transaction Statistics', 
             fontsize=15, color='#333333', pad=20, loc='left')

ax.set_xticks(x)
ax.set_xticklabels(session_sizes, fontsize=10, color='#666666')
ax.tick_params(axis='both', colors='#666666', length=0)

ax.legend(loc='upper left', fontsize=11, frameon=True,
          facecolor='white', edgecolor='#CCCCCC', framealpha=0.9)
ax.grid(axis='y', alpha=0.2, linestyle='-', linewidth=1, color='#CCCCCC')
ax.set_axisbelow(True)

fig.patch.set_facecolor('white')
ax.set_facecolor('#FAFAFA')

plt.tight_layout()

plt.savefig('transaction_statistics_stacked.png', dpi=300, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.savefig('transaction_statistics_stacked.pdf', bbox_inches='tight',
            facecolor='white', edgecolor='none')

print("\nModern stacked bar chart saved as:")
print("- transaction_statistics_stacked.png")
print("- transaction_statistics_stacked.pdf")

plt.show()

# Create line plot with modern styling
fig, ax = plt.subplots(figsize=(10, 6), dpi=300)

ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#CCCCCC')
ax.spines['bottom'].set_color('#CCCCCC')

participant_numbers = [2, 4, 6, 8, 10]

ax.plot(participant_numbers, successful, marker='o', linewidth=2.5,
        markersize=8, label='Successful', color='#52B788',
        markerfacecolor='#52B788', markeredgewidth=0)

ax.plot(participant_numbers, amount_mismatches, marker='s', linewidth=2.5,
        markersize=8, label='Amount Mismatches', color='#FF9F1C',
        markerfacecolor='#FF9F1C', markeredgewidth=0)

ax.plot(participant_numbers, commitment_violations, marker='^', linewidth=2.5,
        markersize=8, label='Commitment Violations', color='#E63946',
        markerfacecolor='#E63946', markeredgewidth=0)

ax.set_xlabel('Number of Participants', fontsize=13, color='#333333')
ax.set_ylabel('Transaction Count', fontsize=13, color='#333333')
ax.set_title('Transaction Trends Across Session Sizes', 
             fontsize=15, color='#333333', pad=20, loc='left')

ax.set_xticks(participant_numbers)
ax.tick_params(axis='both', colors='#666666', length=0)

ax.legend(loc='upper left', fontsize=11, frameon=True,
          facecolor='white', edgecolor='#CCCCCC', framealpha=0.9)
ax.grid(True, alpha=0.2, linestyle='-', linewidth=1, color='#CCCCCC')
ax.set_axisbelow(True)

fig.patch.set_facecolor('white')
ax.set_facecolor('#FAFAFA')

plt.tight_layout()

plt.savefig('transaction_statistics_line.png', dpi=300, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.savefig('transaction_statistics_line.pdf', bbox_inches='tight',
            facecolor='white', edgecolor='none')

print("\nModern line plot saved as:")
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