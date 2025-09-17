import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

# Set the academic style
plt.style.use('seaborn-v0_8-paper')
plt.rcParams['font.family'] = 'serif'
plt.rcParams['font.serif'] = ['Times New Roman']
plt.rcParams['font.size'] = 12
plt.rcParams['axes.labelsize'] = 13
plt.rcParams['axes.titlesize'] = 14

# Data from the tables
policies = ['CAT', 'CCR', 'CTS', 'RES']
performance_scores = [0.44, 0.39, 0.48, 0.58]
ranks = [3, 4, 2, 1]
performance_categories = ['Low', 'Low', 'Medium', 'High']

# Color mapping for performance levels
color_map = {
    'Low': '#E84855',      # Red
    'Medium': '#F9DC5C',   # Yellow
    'High': '#8FC93A'      # Green
}
colors = [color_map[cat] for cat in performance_categories]

# Graph 1: Performance Scores Bar Chart
plt.figure(figsize=(10, 6))
bars = plt.bar(policies, performance_scores, color=colors, edgecolor='black', linewidth=2)
plt.ylabel('Performance Score', fontweight='bold', fontsize=14)
plt.xlabel('Policy Type', fontweight='bold', fontsize=14)
plt.title('Policy Performance Scores Comparison', fontweight='bold', fontsize=16)
plt.ylim([0, 0.7])
plt.grid(True, alpha=0.3, axis='y')

# Add value labels on bars
for bar, score in zip(bars, performance_scores):
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2., height + 0.01,
            f'{score:.2f}', ha='center', va='bottom', fontsize=12, fontweight='bold')

# Add performance category labels
for bar, cat in zip(bars, performance_categories):
    plt.text(bar.get_x() + bar.get_width()/2., 0.02,
            cat, ha='center', va='bottom', fontsize=11, 
            color='white', fontweight='bold')

plt.tight_layout()
plt.savefig('policy_performance_scores.pdf', dpi=300, bbox_inches='tight')
plt.show()

# Graph 2: Ranking Horizontal Bar Chart
plt.figure(figsize=(10, 6))
y_pos = np.arange(len(policies))
# Sort by rank for better visualization
sorted_indices = np.argsort(ranks)
sorted_policies = [policies[i] for i in sorted_indices]
sorted_scores = [performance_scores[i] for i in sorted_indices]
sorted_colors = [colors[i] for i in sorted_indices]
sorted_ranks = sorted(ranks)

bars = plt.barh(y_pos, sorted_scores, color=sorted_colors, edgecolor='black', linewidth=2)
plt.yticks(y_pos, [f'{p}' for p in sorted_policies])
plt.xlabel('Performance Score', fontweight='bold', fontsize=14)
plt.ylabel('Policy', fontweight='bold', fontsize=14)
plt.title('Policy Rankings by Performance Score', fontweight='bold', fontsize=16)
plt.grid(True, alpha=0.3, axis='x')

# Add value and rank labels
for i, (bar, score, rank) in enumerate(zip(bars, sorted_scores, sorted_ranks)):
    plt.text(score + 0.01, bar.get_y() + bar.get_height()/2.,
            f'{score:.2f} (Rank {rank})', ha='left', va='center', 
            fontsize=11, fontweight='bold')

plt.tight_layout()
plt.savefig('policy_rankings.pdf', dpi=300, bbox_inches='tight')
plt.show()

# Graph 3: Radar Chart
fig = plt.figure(figsize=(10, 10))
ax = plt.subplot(111, projection='polar')

angles = np.linspace(0, 2 * np.pi, len(policies), endpoint=False).tolist()
scores_normalized = [s/max(performance_scores) for s in performance_scores]
scores_normalized += scores_normalized[:1]  # Complete the circle
angles += angles[:1]

ax.plot(angles, scores_normalized, 'o-', linewidth=3, color='#2E4057', markersize=10)
ax.fill(angles, scores_normalized, alpha=0.25, color='#2E4057')
ax.set_xticks(angles[:-1])
ax.set_xticklabels(policies, fontsize=14, fontweight='bold')
ax.set_ylim(0, 1)
ax.set_title('Policy Performance Radar Chart\n(Normalized Scores)', 
             fontweight='bold', fontsize=16, pad=30)
ax.grid(True, linewidth=1.5)

# Add score labels
for angle, score, policy in zip(angles[:-1], performance_scores, policies):
    ax.text(angle, scores_normalized[policies.index(policy)] + 0.05, 
            f'{score:.2f}', ha='center', fontsize=11, fontweight='bold')

plt.tight_layout()
plt.savefig('policy_radar_chart.pdf', dpi=300, bbox_inches='tight')
plt.show()

# Graph 4: Combined Bar and Line Chart
fig, ax1 = plt.subplots(figsize=(10, 6))

x = np.arange(len(policies))
width = 0.6

# Bar chart for performance scores
bars = ax1.bar(x, performance_scores, width, color=colors, 
               edgecolor='black', linewidth=2, alpha=0.8)
ax1.set_xlabel('Policy Type', fontweight='bold', fontsize=14)
ax1.set_ylabel('Performance Score', fontweight='bold', fontsize=14)
ax1.set_title('Performance Scores with Rank Indicators', fontweight='bold', fontsize=16)
ax1.set_xticks(x)
ax1.set_xticklabels(policies)
ax1.set_ylim([0, 0.7])

# Add score labels
for bar, score in zip(bars, performance_scores):
    height = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2., height + 0.01,
            f'{score:.2f}', ha='center', va='bottom', fontsize=11, fontweight='bold')

# Add rank labels at the top
for i, (policy, rank) in enumerate(zip(policies, ranks)):
    ax1.text(i, 0.65, f'Rank #{rank}', ha='center', fontsize=11, 
            fontweight='bold', color='darkblue')

ax1.grid(True, alpha=0.3, axis='y')
plt.tight_layout()
plt.savefig('policy_scores_with_ranks.pdf', dpi=300, bbox_inches='tight')
plt.show()

# Graph 5: Performance Category Distribution
plt.figure(figsize=(10, 6))
category_counts = {'Low': 2, 'Medium': 1, 'High': 1}
categories = list(category_counts.keys())
counts = list(category_counts.values())
cat_colors = [color_map[cat] for cat in categories]

bars = plt.bar(categories, counts, color=cat_colors, edgecolor='black', linewidth=2)
plt.ylabel('Number of Policies', fontweight='bold', fontsize=14)
plt.xlabel('Performance Category', fontweight='bold', fontsize=14)
plt.title('Distribution of Policies by Performance Category', fontweight='bold', fontsize=16)
plt.ylim([0, 3])

# Add count labels
for bar, count in zip(bars, counts):
    plt.text(bar.get_x() + bar.get_width()/2., count + 0.05,
            f'{count}', ha='center', va='bottom', fontsize=12, fontweight='bold')

# Add policy names in each category
for i, (cat, bar) in enumerate(zip(categories, bars)):
    policies_in_cat = [policies[j] for j, c in enumerate(performance_categories) if c == cat]
    plt.text(bar.get_x() + bar.get_width()/2., 0.1,
            ', '.join(policies_in_cat), ha='center', va='bottom', 
            fontsize=10, color='white', fontweight='bold')

plt.grid(True, alpha=0.3, axis='y')
plt.tight_layout()
plt.savefig('policy_category_distribution.pdf', dpi=300, bbox_inches='tight')
plt.show()

# Graph 6: Performance Score Comparison Line Chart
plt.figure(figsize=(10, 6))
x_positions = np.arange(len(policies))
plt.plot(x_positions, performance_scores, 'o-', linewidth=3, markersize=12, color='#2E4057')

# Color each point based on performance category
for i, (x, y, col) in enumerate(zip(x_positions, performance_scores, colors)):
    plt.plot(x, y, 'o', markersize=12, color=col, markeredgecolor='black', markeredgewidth=2)

plt.xlabel('Policy Type', fontweight='bold', fontsize=14)
plt.ylabel('Performance Score', fontweight='bold', fontsize=14)
plt.title('Policy Performance Score Progression', fontweight='bold', fontsize=16)
plt.xticks(x_positions, policies)
plt.ylim([0.3, 0.65])
plt.grid(True, alpha=0.3)

# Add value labels
for x, y, policy in zip(x_positions, performance_scores, policies):
    plt.text(x, y + 0.02, f'{y:.2f}', ha='center', fontsize=11, fontweight='bold')

# Add horizontal lines for thresholds
plt.axhline(y=0.5, color='gray', linestyle='--', alpha=0.5, label='Medium Threshold')
plt.axhline(y=0.4, color='gray', linestyle='--', alpha=0.5, label='Low Threshold')

plt.legend(loc='upper left')
plt.tight_layout()
plt.savefig('policy_performance_progression.pdf', dpi=300, bbox_inches='tight')
plt.show()

print("All individual graphs generated successfully!")
print("Files saved:")
print("1. policy_performance_scores.pdf")
print("2. policy_rankings.pdf")
print("3. policy_radar_chart.pdf")
print("4. policy_scores_with_ranks.pdf")
print("5. policy_category_distribution.pdf")
print("6. policy_performance_progression.pdf")