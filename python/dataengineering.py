import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

# Setting visual style
sns.set_style("whitegrid")
plt.rcParams.update({'font.size': 12})

# Performance metrics from the papers
metrics = {
    'Systems': ['RekShare', 'FlexIM', 'vChain+', 'DBA Bandits', 'Single-HR/NoIndex'],
    
    # Execution performance (ms)
    'Execution Time (ms)': [107.2, 107.2, 165.0, 135.7, 150.0],
    'Confirmation Time (ms)': [122.8, 122.8, 210.3, 180.5, 220.8],
    
    # Transaction costs (ETH)
    'Gas Cost (ETH)': [0.000433, 0.000433, 0.000721, 0.000612, 0.000564],
    
    # Reliability metrics
    'Success Rate (%)': [100, 99.5, 89, 95, 92],
    'Failed Transactions': [296, 296, 620, 450, 480],
    
    # Scalability metrics
    'Scalability (Nodes)': [4520, 4520, 2800, 3200, 1800],
    'Storage Overhead (MB)': [500, 29.7, 8597, 500, 250],
    
    # Construction metrics
    'Deployment Cost (ETH)': [0.002598, 0.002598, 0.003845, 0.003112, 0.002912],
    'Construction Time Reduction (%)': [95.6, 95.6, 0, 95.6, 85.0]
}

# Create DataFrame
df = pd.DataFrame(metrics)

# Function to create comparison charts
def create_comparison_chart(metric, title, ylabel, lower_is_better=True):
    plt.figure(figsize=(12, 6))
    
    # Sort based on metric performance
    sorted_df = df.sort_values(by=metric, ascending=lower_is_better)
    
    # Create bar chart
    colors = ['#1f77b4' if system in ['RekShare', 'FlexIM'] else '#7f7f7f' 
              for system in sorted_df['Systems']]
    
    ax = plt.bar(sorted_df['Systems'], sorted_df[metric], color=colors)
    
    # Add values on top of bars
    for i, v in enumerate(sorted_df[metric]):
        plt.text(i, v + (max(sorted_df[metric]) * 0.02), 
                 f"{v}", ha='center')
    
    plt.title(title)
    plt.ylabel(ylabel)
    plt.xticks(rotation=45)
    plt.tight_layout()
    
    # Highlight best performer
    best_idx = 0 if lower_is_better else len(sorted_df) - 1
    plt.bar(sorted_df['Systems'].iloc[best_idx], 
            sorted_df[metric].iloc[best_idx], 
            color='#2ca02c')
    
    return plt

# Generate individual charts
execution_chart = create_comparison_chart('Execution Time (ms)', 
                                         'Execution Time Comparison', 
                                         'Time (ms)')

gas_chart = create_comparison_chart('Gas Cost (ETH)', 
                                    'Transaction Gas Cost Comparison', 
                                    'Cost (ETH)')

success_chart = create_comparison_chart('Success Rate (%)', 
                                        'Transaction Success Rate Comparison', 
                                        '% Success', 
                                        lower_is_better=False)

storage_chart = create_comparison_chart('Storage Overhead (MB)', 
                                        'Storage Overhead Comparison', 
                                        'Size (MB)')

scalability_chart = create_comparison_chart('Scalability (Nodes)', 
                                           'Scalability Comparison', 
                                           'Number of Nodes', 
                                           lower_is_better=False)

# Create a radar chart for overall comparison
def create_radar_chart():
    # Select metrics for radar chart
    radar_metrics = [
        'Execution Time (ms)', 'Gas Cost (ETH)', 
        'Success Rate (%)', 'Scalability (Nodes)', 
        'Storage Overhead (MB)', 'Deployment Cost (ETH)'
    ]
    
    # Normalize data for radar chart (0-1 scale)
    radar_df = df.copy()
    for metric in radar_metrics:
        if metric in ['Success Rate (%)', 'Scalability (Nodes)']:
            # Higher is better
            radar_df[metric] = (radar_df[metric] - radar_df[metric].min()) / (radar_df[metric].max() - radar_df[metric].min())
        else:
            # Lower is better
            radar_df[metric] = 1 - (radar_df[metric] - radar_df[metric].min()) / (radar_df[metric].max() - radar_df[metric].min())
    
    # Set up radar chart
    fig = plt.figure(figsize=(10, 10))
    ax = fig.add_subplot(111, polar=True)
    
    # Number of variables
    N = len(radar_metrics)
    
    # Angle of each axis
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]  # Close the loop
    
    # Plot each system
    for i, system in enumerate(radar_df['Systems']):
        values = radar_df.loc[i, radar_metrics].values.tolist()
        values += values[:1]  # Close the loop
        
        # Plot values
        ax.plot(angles, values, linewidth=2, linestyle='solid', label=system)
        ax.fill(angles, values, alpha=0.1)
    
    # Set category labels
    plt.xticks(angles[:-1], radar_metrics, size=10)
    
    # Draw y-axis lines for each angle and add labels
    ax.set_rlabel_position(0)
    plt.yticks([0.25, 0.5, 0.75], ["0.25", "0.5", "0.75"], color="grey", size=8)
    plt.ylim(0, 1)
    
    # Add legend
    plt.legend(loc='upper right', bbox_to_anchor=(0.1, 0.1))
    
    plt.title("Multi-dimensional Performance Comparison", size=15)
    return plt

radar_chart = create_radar_chart()

# Generate a summary table
def generate_summary_table():
    # Define which metrics are better when higher/lower
    higher_better = ['Success Rate (%)', 'Scalability (Nodes)', 'Construction Time Reduction (%)']
    
    # Calculate performance relative to best system for each metric
    summary = pd.DataFrame()
    summary['Systems'] = df['Systems']
    
    for metric in df.columns[1:]:
        if metric in higher_better:
            best_value = df[metric].max()
            summary[f"{metric} (% of best)"] = (df[metric] / best_value * 100).round(1)
        else:
            best_value = df[metric].min()
            summary[f"{metric} (% of best)"] = (best_value / df[metric] * 100).round(1)
    
    # Calculate average performance
    perf_columns = [col for col in summary.columns if '% of best' in col]
    summary['Overall Score'] = summary[perf_columns].mean(axis=1).round(1)
    
    # Sort by overall score
    return summary.sort_values('Overall Score', ascending=False).reset_index(drop=True)

summary_table = generate_summary_table()
print(summary_table)

# Save all charts
execution_chart.savefig('execution_comparison.png')
gas_chart.savefig('gas_cost_comparison.png')
success_chart.savefig('success_rate_comparison.png')
storage_chart.savefig('storage_comparison.png')
scalability_chart.savefig('scalability_comparison.png')
radar_chart.savefig('radar_comparison.png')

print("Comparative analysis complete. Charts saved to disk.")