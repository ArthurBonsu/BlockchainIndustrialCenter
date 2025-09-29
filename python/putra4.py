import matplotlib.pyplot as plt
import numpy as np

# Set modern style
plt.style.use('seaborn-v0_8-whitegrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica']

# Data
participants = [2, 4, 6, 8, 10]
sessions = [20, 19, 16, 18, 27]

# Create figure with modern styling
fig, ax = plt.subplots(figsize=(8, 6), dpi=300)

# Remove top and right spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#CCCCCC')
ax.spines['bottom'].set_color('#CCCCCC')

# Create bar plot without black borders
bars = ax.bar(participants, sessions, width=1.5, 
               color='#2E86AB', edgecolor='none', alpha=0.85)

# Customize the plot
ax.set_xlabel('Number of Participants', fontsize=13, color='#333333')
ax.set_ylabel('Number of Sessions', fontsize=13, color='#333333')
ax.set_title('Distribution of Sessions by Participant Count', 
             fontsize=15, color='#333333', pad=20, loc='left')

# Set axis properties
ax.set_xticks(participants)
ax.tick_params(axis='both', labelsize=11, colors='#666666', length=0)
ax.set_xlim(0, 12)
ax.set_ylim(0, max(sessions) + 5)

# Subtle grid
ax.grid(axis='y', alpha=0.2, linestyle='-', linewidth=1, color='#CCCCCC')
ax.set_axisbelow(True)

# Add value labels on top of bars
for bar in bars:
    height = bar.get_height()
    ax.text(bar.get_x() + bar.get_width()/2., height + 0.5,
            f'{int(height)}',
            ha='center', va='bottom', fontsize=10, color='#333333')

# Set background colors
fig.patch.set_facecolor('white')
ax.set_facecolor('#FAFAFA')

# Adjust layout
plt.tight_layout()

# Save as both PNG and PDF
plt.savefig('sessions_per_participant.png', dpi=300, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.savefig('sessions_per_participant.pdf', bbox_inches='tight',
            facecolor='white', edgecolor='none')

print("Modern graphs saved as:")
print("- sessions_per_participant.png")
print("- sessions_per_participant.pdf")

# Display the plot
plt.show()

# Create line plot version with modern styling
fig, ax = plt.subplots(figsize=(8, 6), dpi=300)

# Remove spines
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
ax.spines['left'].set_color('#CCCCCC')
ax.spines['bottom'].set_color('#CCCCCC')

# Line plot without borders
ax.plot(participants, sessions, marker='o', linewidth=2.5, 
        markersize=8, color='#2E86AB', markerfacecolor='#2E86AB',
        markeredgewidth=0)

ax.set_xlabel('Number of Participants', fontsize=13, color='#333333')
ax.set_ylabel('Number of Sessions', fontsize=13, color='#333333')
ax.set_title('Session Frequency Across Participant Groups', 
             fontsize=15, color='#333333', pad=20, loc='left')

ax.set_xticks(participants)
ax.tick_params(axis='both', labelsize=11, colors='#666666', length=0)
ax.set_xlim(1, 11)
ax.set_ylim(14, max(sessions) + 3)

# Subtle grid
ax.grid(True, alpha=0.2, linestyle='-', linewidth=1, color='#CCCCCC')
ax.set_axisbelow(True)

# Add value labels
for x, y in zip(participants, sessions):
    ax.annotate(f'{y}', xy=(x, y), xytext=(0, 8),
                textcoords='offset points', ha='center',
                fontsize=10, color='#333333')

# Set background colors
fig.patch.set_facecolor('white')
ax.set_facecolor('#FAFAFA')

plt.tight_layout()

plt.savefig('sessions_per_participant_line.png', dpi=300, bbox_inches='tight',
            facecolor='white', edgecolor='none')
plt.savefig('sessions_per_participant_line.pdf', bbox_inches='tight',
            facecolor='white', edgecolor='none')

print("\nModern line plot saved as:")
print("- sessions_per_participant_line.png")
print("- sessions_per_participant_line.pdf")

plt.show()