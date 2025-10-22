import matplotlib.pyplot as plt
import numpy as np

# Data
participants = [2, 4, 6, 8, 10]
sessions = [20, 19, 16, 18, 27]

# Create figure with academic styling
plt.figure(figsize=(8, 6), dpi=300)

# Create bar plot
bars = plt.bar(participants, sessions, width=1.5, 
               color='#2E86AB', edgecolor='black', linewidth=1.2,
               alpha=0.8)

# Customize the plot
plt.xlabel('Number of Participants', fontsize=14, fontweight='bold')
plt.ylabel('Number of Sessions', fontsize=14, fontweight='bold')
plt.title('Distribution of Sessions by Participant Count', 
          fontsize=16, fontweight='bold', pad=20)

# Set axis properties
plt.xticks(participants, fontsize=12)
plt.yticks(fontsize=12)
plt.xlim(0, 12)
plt.ylim(0, max(sessions) + 5)

# Add grid for better readability
plt.grid(axis='y', alpha=0.3, linestyle='--', linewidth=0.7)

# Add value labels on top of bars
for bar in bars:
    height = bar.get_height()
    plt.text(bar.get_x() + bar.get_width()/2., height,
             f'{int(height)}',
             ha='center', va='bottom', fontsize=11, fontweight='bold')

# Adjust layout to prevent label cutoff
plt.tight_layout()

# Save as both PNG and PDF
plt.savefig('sessions_per_participant.png', dpi=300, bbox_inches='tight')
plt.savefig('sessions_per_participant.pdf', bbox_inches='tight')

print("Graphs saved as:")
print("- sessions_per_participant.png")
print("- sessions_per_participant.pdf")

# Display the plot
plt.show()

# Optional: Create a line plot version for trend analysis
plt.figure(figsize=(8, 6), dpi=300)

plt.plot(participants, sessions, marker='o', linewidth=2.5, 
         markersize=10, color='#2E86AB', markerfacecolor='white',
         markeredgewidth=2, markeredgecolor='#2E86AB')

plt.xlabel('Number of Participants', fontsize=14, fontweight='bold')
plt.ylabel('Number of Sessions', fontsize=14, fontweight='bold')
plt.title('Session Frequency Across Participant Groups', 
          fontsize=16, fontweight='bold', pad=20)

plt.xticks(participants, fontsize=12)
plt.yticks(fontsize=12)
plt.xlim(1, 11)
plt.ylim(14, max(sessions) + 3)

plt.grid(True, alpha=0.3, linestyle='--', linewidth=0.7)

# Add value labels
for x, y in zip(participants, sessions):
    plt.annotate(f'{y}', xy=(x, y), xytext=(0, 8),
                textcoords='offset points', ha='center',
                fontsize=10, fontweight='bold')

plt.tight_layout()

plt.savefig('sessions_per_participant_line.png', dpi=300, bbox_inches='tight')
plt.savefig('sessions_per_participant_line.pdf', bbox_inches='tight')

print("\nLine plot versions saved as:")
print("- sessions_per_participant_line.png")
print("- sessions_per_participant_line.pdf")