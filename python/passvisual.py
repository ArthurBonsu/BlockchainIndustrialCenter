import matplotlib.pyplot as plt
import numpy as np
import seaborn as sns
import os
import time

# Performance optimization settings
plt.rcParams['figure.dpi'] = 100  # Lower default DPI for faster rendering
plt.rcParams['savefig.dpi'] = 200  # Lower saving DPI while maintaining quality
plt.rcParams['path.simplify'] = True
plt.rcParams['path.simplify_threshold'] = 0.9

# Create output directory if it doesn't exist
os.makedirs('pays_analysis_charts', exist_ok=True)

# Set style for professional scientific plots
plt.style.use('seaborn-v0_8-whitegrid')
sns.set_palette("husl")

# Function to create and save individual plots with performance tracking
def create_and_save_plot(plot_number, title, plot_function):
    start_time = time.time()
    plt.figure(figsize=(8, 6))  # Reduced figure size for faster rendering
    plt.suptitle(title, fontsize=14, fontweight='bold', y=0.98)
    plot_function()
    plt.tight_layout()
    filename = f'pays_analysis_charts/chart_{plot_number}_{title.replace(" ", "_").replace(":", "").lower()}.png'
    plt.savefig(filename, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close()
    end_time = time.time()
    print(f"Saved: {filename} ({end_time - start_time:.2f}s)")

# Data from experimental results
pays_data = {
    'connection_time': 16.1,
    'latency': 13.7,
    'confidence': 100.0,
    'accuracy': 92.1,
    'cost': 1028454
}

polkadot_data = {
    'connection_time': 47.6,
    'latency': 25.1,
    'confidence': 71.1,
    'accuracy': 66.5,
    'cost': 1500000
}

# Baseline test results (10 scenarios)
baseline_pays = [14, 12, 10, 11, 14, 14, 14, 15, 11, 13]
baseline_polkadot = [35, 28, 37, 38, 27, 32, 37, 34, 29, 33]
baseline_pays_conf = [100] * 10
baseline_polkadot_conf = [81.5, 73.2, 72.1, 73.1, 78.5, 87.4, 81.8, 75.6, 79.7, 79.7]

# Load testing data
load_levels = ['Light (10%)', 'Moderate (50%)', 'Heavy (80%)', 'Extreme (95%)']
pays_load_times = [15, 18, 27, 37]
polkadot_load_times = [52, 62, 93, 130]
pays_load_accuracy = [97, 93, 90, 88.5]
polkadot_load_accuracy = [76, 68, 62, 60]

# 1. Connection Time Comparison Bar Chart
def create_performance_metrics_chart():
    categories = ['Connection Time\n(ms)', 'Latency\n(ms)', 'Confidence\nScore', 'Accuracy\n(%)', 'Cost\n(Wei/1000)']
    pays_values = [pays_data['connection_time'], pays_data['latency'], 
                pays_data['confidence'], pays_data['accuracy'], pays_data['cost']/1000]
    polkadot_values = [polkadot_data['connection_time'], polkadot_data['latency'],
                    polkadot_data['confidence'], polkadot_data['accuracy'], polkadot_data['cost']/1000]

    x = np.arange(len(categories))
    width = 0.35

    bars1 = plt.bar(x - width/2, pays_values, width, label='PAYS', color='#2E8B57', alpha=0.8)
    bars2 = plt.bar(x + width/2, polkadot_values, width, label='Polkadot', color='#FF6B6B', alpha=0.8)

    plt.title('Performance Metrics Comparison', fontweight='bold', fontsize=14)
    plt.xticks(x, categories, rotation=45, ha='right')
    plt.legend()
    plt.grid(True, alpha=0.3)

    # Add value labels on bars
    for bar in bars1:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + max(pays_values)*0.01,
                f'{height:.1f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

    for bar in bars2:
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + max(polkadot_values)*0.01,
                f'{height:.1f}', ha='center', va='bottom', fontsize=10, fontweight='bold')

# 2. Baseline Performance Time Series
def create_baseline_performance_chart():
    scenarios = range(1, 11)
    plt.plot(scenarios, baseline_pays, 'o-', label='PAYS', linewidth=3, markersize=8, color='#2E8B57')
    plt.plot(scenarios, baseline_polkadot, 's-', label='Polkadot', linewidth=3, markersize=8, color='#FF6B6B')
    plt.title('Baseline Connection Time (10 Test Scenarios)', fontweight='bold', fontsize=14)
    plt.xlabel('Test Scenario')
    plt.ylabel('Connection Time (ms)')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.ylim(0, max(baseline_polkadot) * 1.1)

# 3. Confidence Score Distribution
def create_confidence_score_chart():
    confidence_data = [baseline_pays_conf, baseline_polkadot_conf]
    tick_labels = ['PAYS', 'Polkadot']
    colors = ['#2E8B57', '#FF6B6B']

    box_plot = plt.boxplot(confidence_data, tick_labels=tick_labels, patch_artist=True)
    for patch, color in zip(box_plot['boxes'], colors):
        patch.set_facecolor(color)
        patch.set_alpha(0.7)

    plt.title('Confidence Score Distribution', fontweight='bold', fontsize=14)
    plt.ylabel('Confidence Score')
    plt.grid(True, alpha=0.3)

# 4. Load Testing Performance
def create_load_testing_chart():
    x_load = np.arange(len(load_levels))
    width = 0.35
    
    bars1 = plt.bar(x_load - width/2, pays_load_times, width, label='PAYS', color='#2E8B57', alpha=0.8)
    bars2 = plt.bar(x_load + width/2, polkadot_load_times, width, label='Polkadot', color='#FF6B6B', alpha=0.8)

    plt.title('Performance Under Network Load', fontweight='bold', fontsize=14)
    plt.xlabel('Network Load Level')
    plt.ylabel('Connection Time (ms)')
    plt.xticks(x_load, load_levels, rotation=45, ha='right')
    plt.legend()
    plt.grid(True, alpha=0.3)

# 5. Accuracy vs Load Scatter Plot
def create_accuracy_load_chart():
    load_percentages = [10, 50, 80, 95]
    plt.scatter(load_percentages, pays_load_accuracy, s=100, c='#2E8B57', label='PAYS', alpha=0.8, marker='o')
    plt.scatter(load_percentages, polkadot_load_accuracy, s=100, c='#FF6B6B', label='Polkadot', alpha=0.8, marker='s')
    plt.plot(load_percentages, pays_load_accuracy, '--', color='#2E8B57', alpha=0.6)
    plt.plot(load_percentages, polkadot_load_accuracy, '--', color='#FF6B6B', alpha=0.6)

    plt.title('Accuracy vs Network Load', fontweight='bold', fontsize=14)
    plt.xlabel('Network Load (%)')
    plt.ylabel('Accuracy (%)')
    plt.legend()
    plt.grid(True, alpha=0.3)

# 6. Improvement Percentages Chart
def create_improvement_chart():
    improvements = [66.3, 45.4, 40.6, 38.5, 31.4]  # Connection, Latency, Confidence, Accuracy, Cost
    improvement_labels = ['Connection\nTime', 'Latency', 'Confidence', 'Accuracy', 'Cost']

    x_imp = np.arange(len(improvement_labels))
    bars = plt.bar(x_imp, improvements, color='#2E8B57', alpha=0.8)
    plt.title('PAYS Performance Improvements (%)', fontweight='bold', fontsize=14)
    plt.ylabel('Improvement Percentage (%)')
    plt.xticks(x_imp, improvement_labels, rotation=45, ha='right')
    plt.grid(True, alpha=0.3)

    # Add percentage labels
    for i, bar in enumerate(bars):
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + 1,
                f'{improvements[i]:.1f}%', ha='center', va='bottom', fontweight='bold')

# 7. Dual Transaction Architecture Comparison
def create_dual_transaction_chart():
    transaction_types = ['Speculative', 'Confirmable', 'Polkadot\nSingle']
    connection_times = [8, 15, 25]
    accuracies = [85, 98, 78]

    x_trans = np.arange(len(transaction_types))
    fig, ax1 = plt.subplots(figsize=(10, 8))
    ax2 = ax1.twinx()
    
    bars = ax1.bar(x_trans, connection_times, alpha=0.7, color='#4CAF50', label='Connection Time (ms)')
    line = ax2.plot(x_trans, accuracies, 'ro-', linewidth=3, markersize=8, label='Accuracy (%)')

    plt.title('Dual Transaction Architecture', fontweight='bold', fontsize=14)
    ax1.set_ylabel('Connection Time (ms)', color='#4CAF50')
    ax2.set_ylabel('Accuracy (%)', color='red')
    plt.xticks(x_trans, transaction_types, rotation=45, ha='right')
    ax1.grid(True, alpha=0.3)
    
    # Create combined legend
    lines, labels = ax1.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(lines + lines2, labels + labels2, loc='upper left')
    
    plt.tight_layout()
    filename = f'pays_analysis_charts/chart_7_dual_transaction_architecture.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close()
    print(f"Saved: {filename}")
    return False  # Return False to skip the standard create_and_save_plot function

# 8. Cost Efficiency Analysis
def create_cost_efficiency_chart():
    cost_categories = ['PAYS', 'Polkadot']
    costs = [pays_data['cost']/1000, polkadot_data['cost']/1000]  # Convert to thousands
    colors = ['#2E8B57', '#FF6B6B']

    wedges, texts, autotexts = plt.pie(costs, labels=cost_categories, colors=colors, 
                                    autopct='%1.1f%%', startangle=90)
                                    
    # Set alpha for wedges after creating the pie chart
    for w in wedges:
        w.set_alpha(0.8)
        
    plt.title('Network Cost Distribution (Wei x1000)', fontweight='bold', fontsize=14)

    # Make percentage text bold
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')

# 9. Statistical Summary Table
def create_summary_table():
    plt.axis('off')
    
    # Create summary statistics table
    table_data = [
        ['Metric', 'PAYS', 'Polkadot', 'Improvement'],
        ['Conn. Time (ms)', f'{pays_data["connection_time"]:.1f}', f'{polkadot_data["connection_time"]:.1f}', '66.3%'],
        ['Latency (ms)', f'{pays_data["latency"]:.1f}', f'{polkadot_data["latency"]:.1f}', '45.4%'],
        ['Confidence', f'{pays_data["confidence"]:.1f}', f'{polkadot_data["confidence"]:.1f}', '40.6%'],
        ['Accuracy (%)', f'{pays_data["accuracy"]:.1f}', f'{polkadot_data["accuracy"]:.1f}', '38.5%'],
        ['Cost (Wei)', f'{pays_data["cost"]:,}', f'{polkadot_data["cost"]:,}', '31.4%']
    ]

    table = plt.table(cellText=table_data[1:], colLabels=table_data[0], 
                    cellLoc='center', loc='center', bbox=[0.1, 0.1, 0.8, 0.8])
    table.auto_set_font_size(False)
    table.set_fontsize(12)
    table.scale(1, 1.5)

    # Style the header row
    for i in range(len(table_data[0])):
        table[(0, i)].set_facecolor('#E8E8E8')
        table[(0, i)].set_text_props(weight='bold')

    plt.title('Performance Summary', fontweight='bold', fontsize=14, pad=20)

# 10. Experimental info box (as a separate image)
def create_experimental_info():
    plt.figure(figsize=(8, 6))
    plt.axis('off')
    
    textstr = '''Experimental Conditions:
• Test Network: Sepolia Testnet
• Total Scenarios: 20 tests
• Statistical Significance: p < 0.001
• Effect Size: 1.522 (large)
• Load Levels: 10%-95%'''

    props = dict(boxstyle='round', facecolor='lightblue', alpha=0.8)
    plt.text(0.5, 0.5, textstr, fontsize=14, verticalalignment='center', 
             horizontalalignment='center', bbox=props, transform=plt.gca().transAxes)
    
    plt.title('Experimental Information', fontweight='bold', fontsize=14)
    plt.tight_layout()
    filename = f'pays_analysis_charts/chart_10_experimental_info.png'
    plt.savefig(filename, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none')
    plt.close()
    print(f"Saved: {filename}")
    return False  # Return False to skip the standard create_and_save_plot function

# Create and save all individual charts
if __name__ == "__main__":
    start_total = time.time()
    print("Generating individual PAYS vs Polkadot analysis charts...")

    # Create each chart individually
    create_and_save_plot(1, "Performance Metrics Comparison", create_performance_metrics_chart)
    create_and_save_plot(2, "Baseline Connection Time", create_baseline_performance_chart)
    create_and_save_plot(3, "Confidence Score Distribution", create_confidence_score_chart)
    create_and_save_plot(4, "Performance Under Network Load", create_load_testing_chart)
    create_and_save_plot(5, "Accuracy vs Network Load", create_accuracy_load_chart)
    create_and_save_plot(6, "PAYS Performance Improvements", create_improvement_chart)
    if not create_dual_transaction_chart():  # Special handling for chart with twin axis
        pass
    create_and_save_plot(8, "Network Cost Distribution", create_cost_efficiency_chart)
    create_and_save_plot(9, "Performance Summary", create_summary_table)
    if not create_experimental_info():  # Special handling for info box
        pass

    end_total = time.time()
    duration = end_total - start_total
    print(f"\nAll charts have been saved to the 'pays_analysis_charts' directory in {duration:.2f} seconds.")
    print("Key visualizations generated:")
    print("• Chart 1: Performance metrics comparison")
    print("• Chart 2: Baseline connection time across 10 scenarios")
    print("• Chart 3: Confidence score distributions")
    print("• Chart 4: Performance under varying network loads")
    print("• Chart 5: Accuracy vs network load")
    print("• Chart 6: PAYS performance improvements")
    print("• Chart 7: Dual transaction architecture")
    print("• Chart 8: Network cost distribution")
    print("• Chart 9: Performance summary table")
    print("• Chart 10: Experimental information")