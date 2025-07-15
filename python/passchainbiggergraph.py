import matplotlib.pyplot as plt
import numpy as np

# Data from your table
contracts = ['AssetTransferProcessor', 'BlockchainRegistry', 'BlockchainRegistryBase', 'BlockchainMonitor']
efficiency = [99.06, 99.14, 98.98, 99.15]
events = [0, 1, 0, 1]
tiers = ['Medium', 'High', 'Low', 'Very High']

# Create figure with optimized size
plt.figure(figsize=(14, 10))

# Create bar chart
bars = plt.bar(contracts, efficiency, color=['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'], alpha=0.8, edgecolor='black', linewidth=2)

# Set optimized font sizes for all text elements
plt.title('Contract Efficiency and Tier Metrics (1B)', fontsize=24, fontweight='bold', pad=20)
plt.xlabel('Contract Name', fontsize=20, fontweight='bold')
plt.ylabel('Efficiency (%)', fontsize=20, fontweight='bold')

# Rotate x-axis labels and set font
plt.xticks(rotation=45, ha='right', fontsize=16)
plt.yticks(fontsize=16)

# Add value labels on top of bars with optimized font
for i, (bar, eff, tier, event) in enumerate(zip(bars, efficiency, tiers, events)):
    plt.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.015, 
             f'{eff}%\nTier: {tier}\nEvents: {event}', 
             ha='center', va='bottom', fontsize=14, fontweight='bold')

# Set y-axis limits to show the small differences better
plt.ylim(98.9, 99.25)

# Add grid for better readability
plt.grid(True, alpha=0.3, linestyle='--')

# Adjust layout to prevent label cutoff with more space
plt.tight_layout(pad=2.0)

# Show the plot
plt.show()