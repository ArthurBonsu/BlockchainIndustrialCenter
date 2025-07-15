import matplotlib.pyplot as plt
import numpy as np

# Data from your table (only metrics with numerical values)
metrics = ['Connection Time\n(Avg)', 'Latency\n(Avg)', 'Confidence\nScore', 'Accuracy', 'Network\nCost', 'Processing\nTime']
advantages = [66.3, 45.4, 40.6, 38.5, 31.4, 32.0]
advantage_labels = ['66.3% faster', '45.4% lower', '40.6% higher', '38.5% better', '31.4% cheaper', '32% faster']

# Create figure with large size
plt.figure(figsize=(16, 10))

# Create horizontal bar chart for better readability
colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3']
bars = plt.barh(metrics, advantages, color=colors, alpha=0.8, edgecolor='black', linewidth=3)

# Set large font sizes for all text elements
plt.title('PAYS Performance Advantage Summary', fontsize=32, fontweight='bold', pad=25)
plt.xlabel('Performance Advantage (%)', fontsize=32, fontweight='bold')
plt.ylabel('Metrics', fontsize=32, fontweight='bold')

# Set large font sizes for ticks
plt.xticks(fontsize=26)
plt.yticks(fontsize=24)

# Add value labels at the end of bars with large font
for i, (bar, adv_label) in enumerate(zip(bars, advantage_labels)):
    plt.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2, 
             adv_label, 
             ha='left', va='center', fontsize=22, fontweight='bold')

# Set x-axis limits to accommodate labels
plt.xlim(0, max(advantages) + 15)

# Add grid for better readability
plt.grid(True, alpha=0.3, linestyle='--', axis='x')

# Add a subtle background color
plt.gca().set_facecolor('#F8F9FA')

# Adjust layout to prevent label cutoff
plt.tight_layout()

# Add some styling improvements
plt.gca().spines['top'].set_visible(False)
plt.gca().spines['right'].set_visible(False)
plt.gca().spines['left'].set_linewidth(2)
plt.gca().spines['bottom'].set_linewidth(2)

# Show the plot
plt.show()

# Print summary for reference
print("\nPAYS Performance Advantage Summary:")
print("=" * 50)
for metric, advantage in zip(metrics, advantage_labels):
    print(f"{metric.replace(chr(10), ' ')}: {advantage}")