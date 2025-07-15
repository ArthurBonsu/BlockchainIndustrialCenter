import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Set style for better-looking plots
plt.style.use('seaborn-v0_8')
sns.set_palette("husl")

# Contract deployment data
contract_data = {
    'Contract_Name': [
        'AssetTransferProcessor', 'BlockchainRegistry', 'BlockchainRegistryBase',
        'BlockchainMonitor', 'ChaCha20Poly1305', 'BeeRoutingAlgorithm',
        'ConfidenceScoreCalculator', 'MetadataParser', 'PacechainChannel',
        'RewardBase', 'RewardCalculator', 'RewardToken',
        'SpeculativeTransactionHandler', 'TransactionValidator_v1', 'TransactionValidator_v2'
    ],
    'Block_Number': [
        8467713, 8473912, 8473954, 8467643, 8467657, 8467679,
        8473995, 8467697, 8474012, 8467732, 8468541, 8468653,
        8474025, 8468722, 8468977
    ],
    'Gas_Limit': [
        775314, 1510471, 500490, 1848744, 1352454, 1511129,
        1367234, 2959872, 1199559, 100906, 850604, 1112139,
        1401488, 1264727, 2590774
    ],
    'Gas_Used': [
        768051, 1497419, 495391, 1833029, 1340647, 1498072,
        1355310, 2935408, 1188956, 99927, 842748, 1102224,
        1389295, 1253610, 2569216
    ],
    'Transaction_Hash': [
        '0x6e7ce14994cb33a37e1a5cdac80e199c1674960fbb6d0740575d9ca51f05ff75',
        '0x3cd9f5c7a70764220f7deb8a7c619581e6e2631655c07b0ad721e2fcb5e8a5d9',
        '0xb60fcde2347dafaaa19870febc687a1265732891c8dfe8e4617231cbf86b8f62',
        '0xeb39b1e451e63df38afccf82326f6b35edc145e4b21baa3f3b2088eadc5451b7',
        '0xe982520fc9002569a0e334cf478423b15bbfd933b18604b4bf52f3c2b5dd8e1b',
        '0x098e88b3aef98cdb70f89701f1eb9f1f8453efee6954bedbcaf5a9abd28dc04d',
        '0x84aea997d0600bc4b267c6b256db8ec60b3971a938275c1202e7a47e1a8cf31d',
        '0x113f6972a87f7c04c87a8501df427f57517f4bfe16573c5a23211d4905f6559f',
        '0x0c1c0b7a6b6ae311ea51e97d852e88a58d7fef92aaf10ba13d0194f02e131452',
        '0x449d1dc60b54ed1c24723b531015ce99c490e6489ef1b2da44bc448296590da5',
        '0x40b584d1a1d2e5ead05ec190b96728fd2b3547f8d81078b77fa5d042d1310bee',
        '0x9f87c04189ec8d2740678d99049df642908c562824ed42770b5f223bbee51209',
        '0xf0adf331b40585516c96d5587fc83fe0886c748015072a23f1792862f4b6eb01',
        '0x5f46e53bd441a7375c0c078ea54fb7b18c38b60cfe38ce984048c5ba757c1813',
        '0x0b202815effefa77f9acc06fa0b01cc7289a443cc7ad1e79d1446c91b20f489f'
    ],
    'Events_Count': [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 2, 0, 0, 0],
    'Contract_Address': [
        '0x10906193b9c3a0d5ea7251047c55f5398d6d4990',
        '0xb69ae77d0c2058a5044e13d9a75a3d88912b8508',
        '0xd5f4fdb6a5d0d4b49284435020436cc682e55b00',
        '0xa667741c4e9d1c495a8f708da88e4680020f5001',
        '0x0784263da87294b231d6774c25eb4bc293dc9133',
        '0x1044c0635a05bd0cbe03867912679e769ce570f7',
        '0xea2b8197b9c1fb936cdfcf6633c1837fc9726e5c',
        '0x090d29f45a285fbd0919a2da259fef510ce66030',
        '0xe75bfd5ba206ed5c059efeb0dd1c603f03c6553c',
        '0x6e10e3b56f43d67201c05c361fc9273ee5d5d13d',
        '0x601190db4b2faf164c782987b1ad7eddc37cf191',
        '0x72b9747cbdaccbc5c8f1a11425ea79e1c013b25c',
        '0x9eaac685f82cfd9e9966a1819bc8206a6fe602ca',
        '0xaf18a31bad0ead12bbb3d885a20b5362b1fbfa98',
        '0xb3663f23b9426269c3cba8a44b528df0fa6d91d2'
    ]
}

# Create DataFrame
df = pd.DataFrame(contract_data)

# Calculate additional metrics
df['Gas_Efficiency'] = (df['Gas_Used'] / df['Gas_Limit']) * 100
df['Gas_Waste'] = df['Gas_Limit'] - df['Gas_Used']
df['Deployment_Order'] = range(1, len(df) + 1)

# Categorize contracts by gas usage
def categorize_gas_usage(gas_used):
    if gas_used <= 200000:
        return 'Very Low'
    elif gas_used <= 600000:
        return 'Low'
    elif gas_used <= 1200000:
        return 'Medium'
    elif gas_used <= 1800000:
        return 'High'
    else:
        return 'Very High'

df['Cost_Tier'] = df['Gas_Used'].apply(categorize_gas_usage)

# Set up the plotting configuration
plt.rcParams['figure.figsize'] = (12, 8)
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 14
plt.rcParams['axes.labelsize'] = 12

def create_gas_usage_analysis():
    """Create comprehensive gas usage analysis charts"""
    
    # 1. Gas Usage by Contract (Bar Chart)
    plt.figure(figsize=(15, 8))
    bars = plt.bar(range(len(df)), df['Gas_Used'], 
                   color=plt.cm.viridis(np.linspace(0, 1, len(df))))
    
    plt.title('Gas Usage by Contract Deployment', fontsize=16, fontweight='bold')
    plt.xlabel('Contract Index', fontsize=12)
    plt.ylabel('Gas Used', fontsize=12)
    plt.xticks(range(len(df)), [name[:15] + '...' if len(name) > 15 else name 
                                for name in df['Contract_Name']], rotation=45, ha='right')
    
    # Add value labels on bars
    for i, bar in enumerate(bars):
        height = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2., height + 10000,
                f'{height:,.0f}', ha='center', va='bottom', fontsize=8)
    
    plt.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig('gas_usage_by_contract.png', dpi=300, bbox_inches='tight')
    plt.show()

def create_efficiency_analysis():
    """Create gas efficiency analysis"""
    
    plt.figure(figsize=(14, 8))
    
    # Create efficiency scatter plot
    colors = ['red' if eff < 99 else 'orange' if eff < 99.1 else 'green' 
              for eff in df['Gas_Efficiency']]
    
    scatter = plt.scatter(df['Gas_Used'], df['Gas_Efficiency'], 
                         c=colors, s=100, alpha=0.7, edgecolors='black')
    
    plt.title('Gas Efficiency vs Gas Usage', fontsize=16, fontweight='bold')
    plt.xlabel('Gas Used', fontsize=12)
    plt.ylabel('Gas Efficiency (%)', fontsize=12)
    
    # Add contract name labels
    for i, txt in enumerate(df['Contract_Name']):
        plt.annotate(txt[:10], (df['Gas_Used'].iloc[i], df['Gas_Efficiency'].iloc[i]),
                    xytext=(5, 5), textcoords='offset points', fontsize=8, alpha=0.8)
    
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('gas_efficiency_analysis.png', dpi=300, bbox_inches='tight')
    plt.show()

def create_cost_tier_distribution():
    """Create cost tier distribution pie chart"""
    
    plt.figure(figsize=(10, 8))
    
    cost_tier_counts = df['Cost_Tier'].value_counts()
    colors = ['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc']
    
    wedges, texts, autotexts = plt.pie(cost_tier_counts.values, 
                                      labels=cost_tier_counts.index,
                                      autopct='%1.1f%%',
                                      colors=colors,
                                      explode=[0.05] * len(cost_tier_counts),
                                      shadow=True,
                                      startangle=90)
    
    plt.title('Contract Deployment Cost Tier Distribution', 
              fontsize=16, fontweight='bold')
    
    # Enhance text readability
    for autotext in autotexts:
        autotext.set_color('black')
        autotext.set_fontweight('bold')
    
    plt.tight_layout()
    plt.savefig('cost_tier_distribution.png', dpi=300, bbox_inches='tight')
    plt.show()

def create_timeline_analysis():
    """Create deployment timeline analysis"""
    
    plt.figure(figsize=(14, 8))
    
    # Sort by block number for timeline
    df_sorted = df.sort_values('Block_Number')
    
    plt.plot(df_sorted['Block_Number'], df_sorted['Gas_Used'], 
             marker='o', markersize=8, linewidth=2, alpha=0.7)
    
    plt.title('Contract Deployment Timeline (Gas Usage Over Blocks)', 
              fontsize=16, fontweight='bold')
    plt.xlabel('Block Number', fontsize=12)
    plt.ylabel('Gas Used', fontsize=12)
    
    # Add annotations for high-gas contracts
    high_gas_contracts = df_sorted[df_sorted['Gas_Used'] > 2000000]
    for _, row in high_gas_contracts.iterrows():
        plt.annotate(row['Contract_Name'][:12], 
                    (row['Block_Number'], row['Gas_Used']),
                    xytext=(10, 10), textcoords='offset points',
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="yellow", alpha=0.7),
                    arrowprops=dict(arrowstyle="->", connectionstyle="arc3,rad=0.1"))
    
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('deployment_timeline.png', dpi=300, bbox_inches='tight')
    plt.show()

def create_events_analysis():
    """Create events analysis"""
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
    
    # Events count distribution
    event_counts = df['Events_Count'].value_counts().sort_index()
    bars1 = ax1.bar(event_counts.index, event_counts.values, 
                   color=['lightblue', 'lightgreen', 'lightcoral'])
    ax1.set_title('Event Count Distribution', fontweight='bold')
    ax1.set_xlabel('Number of Events')
    ax1.set_ylabel('Number of Contracts')
    
    # Add value labels
    for bar in bars1:
        height = bar.get_height()
        ax1.text(bar.get_x() + bar.get_width()/2., height + 0.1,
                f'{int(height)}', ha='center', va='bottom')
    
    # Gas usage vs Events
    colors_events = ['red' if count == 0 else 'orange' if count == 1 else 'green' 
                    for count in df['Events_Count']]
    
    scatter = ax2.scatter(df['Events_Count'], df['Gas_Used'], 
                         c=colors_events, s=100, alpha=0.7, edgecolors='black')
    ax2.set_title('Gas Usage vs Event Count', fontweight='bold')
    ax2.set_xlabel('Number of Events')
    ax2.set_ylabel('Gas Used')
    
    plt.tight_layout()
    plt.savefig('events_analysis.png', dpi=300, bbox_inches='tight')
    plt.show()

def create_comprehensive_dashboard():
    """Create a comprehensive dashboard with multiple metrics"""
    
    fig = plt.figure(figsize=(20, 12))
    
    # Create a 2x3 grid of subplots
    gs = fig.add_gridspec(3, 3, hspace=0.3, wspace=0.3)
    
    # 1. Gas Usage Heatmap
    ax1 = fig.add_subplot(gs[0, :2])
    gas_matrix = df[['Gas_Used', 'Gas_Limit', 'Gas_Waste']].T
    sns.heatmap(gas_matrix, annot=True, fmt='.0f', cmap='YlOrRd', ax=ax1)
    ax1.set_title('Gas Metrics Heatmap', fontweight='bold')
    ax1.set_xticklabels([name[:8] for name in df['Contract_Name']], rotation=45)
    
    # 2. Efficiency Distribution
    ax2 = fig.add_subplot(gs[0, 2])
    ax2.hist(df['Gas_Efficiency'], bins=10, color='skyblue', alpha=0.7, edgecolor='black')
    ax2.set_title('Efficiency Distribution', fontweight='bold')
    ax2.set_xlabel('Gas Efficiency (%)')
    ax2.set_ylabel('Frequency')
    
    # 3. Block Timeline
    ax3 = fig.add_subplot(gs[1, :2])
    df_sorted = df.sort_values('Block_Number')
    ax3.plot(range(len(df_sorted)), df_sorted['Gas_Used'], 'o-', linewidth=2, markersize=6)
    ax3.set_title('Deployment Sequence (Gas Usage)', fontweight='bold')
    ax3.set_xlabel('Deployment Order')
    ax3.set_ylabel('Gas Used')
    ax3.grid(True, alpha=0.3)
    
    # 4. Cost Tier Summary
    ax4 = fig.add_subplot(gs[1, 2])
    cost_summary = df['Cost_Tier'].value_counts()
    ax4.pie(cost_summary.values, labels=cost_summary.index, autopct='%1.0f%%',
           colors=['#ff9999', '#66b3ff', '#99ff99', '#ffcc99', '#ff99cc'])
    ax4.set_title('Cost Tier Distribution', fontweight='bold')
    
    # 5. Statistical Summary Table
    ax5 = fig.add_subplot(gs[2, :])
    ax5.axis('off')
    
    stats_data = [
        ['Metric', 'Value', 'Unit'],
        ['Total Contracts', len(df), 'count'],
        ['Average Gas Used', f"{df['Gas_Used'].mean():.0f}", 'gas'],
        ['Median Gas Used', f"{df['Gas_Used'].median():.0f}", 'gas'],
        ['Max Gas Used', f"{df['Gas_Used'].max():,}", 'gas'],
        ['Min Gas Used', f"{df['Gas_Used'].min():,}", 'gas'],
        ['Std Deviation', f"{df['Gas_Used'].std():.0f}", 'gas'],
        ['Average Efficiency', f"{df['Gas_Efficiency'].mean():.2f}", '%'],
        ['Total Gas Consumed', f"{df['Gas_Used'].sum():,}", 'gas'],
        ['Block Range', f"{df['Block_Number'].min()} - {df['Block_Number'].max()}", 'blocks']
    ]
    
    table = ax5.table(cellText=stats_data[1:], colLabels=stats_data[0],
                     cellLoc='center', loc='center', bbox=[0, 0, 1, 1])
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 2)
    
    # Style the table header
    for i in range(3):
        table[(0, i)].set_facecolor('#40466e')
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    plt.suptitle('Blockchain Contract Deployment Analysis Dashboard', 
                fontsize=20, fontweight='bold', y=0.98)
    
    plt.savefig('comprehensive_dashboard.png', dpi=300, bbox_inches='tight')
    plt.show()

def print_statistical_summary():
    """Print detailed statistical summary"""
    print("=" * 60)
    print("BLOCKCHAIN CONTRACT DEPLOYMENT ANALYSIS")
    print("=" * 60)
    
    print(f"\n📊 BASIC STATISTICS:")
    print(f"Total Contracts Analyzed: {len(df)}")
    print(f"Average Gas Used: {df['Gas_Used'].mean():,.0f} gas")
    print(f"Median Gas Used: {df['Gas_Used'].median():,.0f} gas")
    print(f"Standard Deviation: {df['Gas_Used'].std():,.0f} gas")
    print(f"Total Gas Consumed: {df['Gas_Used'].sum():,} gas")
    
    print(f"\n⚡ EFFICIENCY METRICS:")
    print(f"Average Gas Efficiency: {df['Gas_Efficiency'].mean():.2f}%")
    print(f"Highest Efficiency: {df['Gas_Efficiency'].max():.2f}%")
    print(f"Lowest Efficiency: {df['Gas_Efficiency'].min():.2f}%")
    
    print(f"\n🏆 TOP PERFORMERS:")
    top_gas = df.nlargest(3, 'Gas_Used')[['Contract_Name', 'Gas_Used']]
    for idx, (_, row) in enumerate(top_gas.iterrows(), 1):
        print(f"{idx}. {row['Contract_Name']}: {row['Gas_Used']:,} gas")
    
    print(f"\n💡 MOST EFFICIENT:")
    top_eff = df.nlargest(3, 'Gas_Efficiency')[['Contract_Name', 'Gas_Efficiency']]
    for idx, (_, row) in enumerate(top_eff.iterrows(), 1):
        print(f"{idx}. {row['Contract_Name']}: {row['Gas_Efficiency']:.2f}%")
    
    print(f"\n📈 COST TIER DISTRIBUTION:")
    cost_dist = df['Cost_Tier'].value_counts()
    for tier, count in cost_dist.items():
        percentage = (count / len(df)) * 100
        print(f"{tier}: {count} contracts ({percentage:.1f}%)")
    
    print(f"\n🎯 EVENTS ANALYSIS:")
    event_dist = df['Events_Count'].value_counts().sort_index()
    for events, count in event_dist.items():
        percentage = (count / len(df)) * 100
        print(f"{events} Events: {count} contracts ({percentage:.1f}%)")
    
    print(f"\n📅 DEPLOYMENT TIMELINE:")
    print(f"Block Range: {df['Block_Number'].min():,} - {df['Block_Number'].max():,}")
    print(f"Total Blocks Span: {df['Block_Number'].max() - df['Block_Number'].min():,} blocks")
    print(f"Average Deployment Interval: {(df['Block_Number'].max() - df['Block_Number'].min()) / (len(df) - 1):.0f} blocks")

def generate_transaction_hash_analysis():
    """Analyze transaction hash patterns"""
    print(f"\n🔐 TRANSACTION HASH ANALYSIS:")
    print("=" * 40)
    
    # Analyze hash characteristics
    hash_prefixes = [tx_hash[2:4] for tx_hash in df['Transaction_Hash']]
    unique_prefixes = len(set(hash_prefixes))
    
    print(f"Total Transaction Hashes: {len(df)}")
    print(f"Unique Hash Prefixes (first 2 hex chars): {unique_prefixes}")
    print(f"Hash Distribution Entropy: {unique_prefixes / len(df) * 100:.1f}%")
    
    print(f"\nSample Transaction Hashes:")
    for i, (name, tx_hash) in enumerate(zip(df['Contract_Name'][:5], df['Transaction_Hash'][:5])):
        print(f"{i+1}. {name[:20]:<20}: {tx_hash}")

def create_advanced_visualizations():
    """Create advanced visualization charts"""
    
    # 1. Correlation Matrix
    plt.figure(figsize=(10, 8))
    numeric_columns = ['Block_Number', 'Gas_Limit', 'Gas_Used', 'Gas_Efficiency', 'Events_Count']
    correlation_matrix = df[numeric_columns].corr()
    
    sns.heatmap(correlation_matrix, annot=True, cmap='coolwarm', center=0,
                square=True, fmt='.3f', cbar_kws={'label': 'Correlation Coefficient'})
    plt.title('Contract Metrics Correlation Matrix', fontsize=16, fontweight='bold')
    plt.tight_layout()
    plt.savefig('correlation_matrix.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 2. Box Plot for Gas Usage by Cost Tier
    plt.figure(figsize=(12, 8))
    sns.boxplot(data=df, x='Cost_Tier', y='Gas_Used', 
                order=['Very Low', 'Low', 'Medium', 'High', 'Very High'])
    plt.title('Gas Usage Distribution by Cost Tier', fontsize=16, fontweight='bold')
    plt.xlabel('Cost Tier', fontsize=12)
    plt.ylabel('Gas Used', fontsize=12)
    plt.xticks(rotation=45)
    plt.grid(axis='y', alpha=0.3)
    plt.tight_layout()
    plt.savefig('gas_usage_by_tier_boxplot.png', dpi=300, bbox_inches='tight')
    plt.show()
    
    # 3. Gas Efficiency vs Block Number
    plt.figure(figsize=(14, 8))
    scatter = plt.scatter(df['Block_Number'], df['Gas_Efficiency'], 
                         c=df['Gas_Used'], s=100, alpha=0.7, 
                         cmap='viridis', edgecolors='black')
    
    plt.colorbar(scatter, label='Gas Used')
    plt.title('Gas Efficiency vs Block Number (sized by Gas Usage)', 
              fontsize=16, fontweight='bold')
    plt.xlabel('Block Number', fontsize=12)
    plt.ylabel('Gas Efficiency (%)', fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('efficiency_vs_block_scatter.png', dpi=300, bbox_inches='tight')
    plt.show()

def export_data_summary():
    """Export detailed data summary to CSV"""
    
    # Create enhanced dataframe with additional calculated metrics
    export_df = df.copy()
    export_df['Gas_Waste_Percentage'] = (export_df['Gas_Waste'] / export_df['Gas_Limit']) * 100
    export_df['Relative_Cost_Index'] = export_df['Gas_Used'] / export_df['Gas_Used'].median()
    export_df['Hash_Prefix'] = export_df['Transaction_Hash'].str[2:6]
    
    # Export to CSV
    export_df.to_csv('blockchain_contract_analysis.csv', index=False)
    print(f"\n💾 Data exported to 'blockchain_contract_analysis.csv'")
    
    # Create summary statistics CSV
    summary_stats = {
        'Metric': [
            'Total Contracts', 'Average Gas Used', 'Median Gas Used', 
            'Standard Deviation', 'Total Gas Consumed', 'Average Efficiency',
            'Max Gas Used', 'Min Gas Used', 'Block Range Start', 'Block Range End'
        ],
        'Value': [
            len(df), df['Gas_Used'].mean(), df['Gas_Used'].median(),
            df['Gas_Used'].std(), df['Gas_Used'].sum(), df['Gas_Efficiency'].mean(),
            df['Gas_Used'].max(), df['Gas_Used'].min(), 
            df['Block_Number'].min(), df['Block_Number'].max()
        ]
    }
    
    summary_df = pd.DataFrame(summary_stats)
    summary_df.to_csv('blockchain_summary_statistics.csv', index=False)
    print(f"📊 Summary statistics exported to 'blockchain_summary_statistics.csv'")

def main():
    """Main execution function"""
    print("🚀 Starting Blockchain Contract Analysis...")
    print("=" * 60)
    
    # Print statistical summary
    print_statistical_summary()
    
    # Generate transaction hash analysis
    generate_transaction_hash_analysis()
    
    # Create all visualizations
    print(f"\n📈 Generating visualizations...")
    
    create_gas_usage_analysis()
    print("✅ Gas usage analysis complete")
    
    create_efficiency_analysis()
    print("✅ Efficiency analysis complete")
    
    create_cost_tier_distribution()
    print("✅ Cost tier distribution complete")
    
    create_timeline_analysis()
    print("✅ Timeline analysis complete")
    
    create_events_analysis()
    print("✅ Events analysis complete")
    
    create_comprehensive_dashboard()
    print("✅ Comprehensive dashboard complete")
    
    create_advanced_visualizations()
    print("✅ Advanced visualizations complete")
    
    # Export data
    export_data_summary()
    
    print(f"\n🎉 Analysis Complete!")
    print("=" * 60)
    print("Generated Files:")
    print("📊 gas_usage_by_contract.png")
    print("📊 gas_efficiency_analysis.png") 
    print("📊 cost_tier_distribution.png")
    print("📊 deployment_timeline.png")
    print("📊 events_analysis.png")
    print("📊 comprehensive_dashboard.png")
    print("📊 correlation_matrix.png")
    print("📊 gas_usage_by_tier_boxplot.png")
    print("📊 efficiency_vs_block_scatter.png")
    print("💾 blockchain_contract_analysis.csv")
    print("💾 blockchain_summary_statistics.csv")

if __name__ == "__main__":
    main()