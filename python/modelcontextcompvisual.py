import matplotlib.pyplot as plt
import numpy as np
import json
from datetime import datetime

# Test results from blockchain
test_results = {
    "phases": 8,
    "gas_total": 1428459,
    "gas_average": 158717,
    "queries": 3,
    "transformations": 3,
    "consensus_tests": 3
}

# MCP Ecosystem data from Guo et al. (2025)
mcp_data = {
    "markets": {
        "MCP.so": {"raw": 16646, "valid": 7223, "rate": 0.434},
        "MCP_Market": {"raw": 14280, "valid": 3765, "rate": 0.264},
        "PulseMCP": {"raw": 6013, "valid": 3576, "rate": 0.595},
        "Smithery": {"raw": 6751, "valid": 2588, "rate": 0.383},
        "Cursor_Dir": {"raw": 1600, "valid": 1197, "rate": 0.748},
        "MCP_Servers": {"raw": 2136, "valid": 997, "rate": 0.467}
    },
    "maintenance": {
        "active_90": 40.9,
        "active_1y": 37.2,
        "abandoned": 21.9
    },
    "languages": {
        "JavaScript": {"servers": 4433, "risk": 61},
        "Python": {"servers": 3087, "risk": 57},
        "Java": {"servers": 126, "risk": 76},
        "Go": {"servers": 331, "risk": 64},
        "Rust": {"servers": 76, "risk": 62},
        "Ruby": {"servers": 7, "risk": 50}
    },
    "protocols": {
        "SSE": 56.9,
        "STDIO": 38.1,
        "OTHER": 5.0
    },
    "sensitive_apis": {
        "External Data": 731,
        "Databases": 168,
        "Cloud Services": 125,
        "Auth Services": 387
    }
}

# Create figure with subplots
fig = plt.figure(figsize=(16, 14))

# ============================================================================
# 1. Schema Complexity: O(N) vs O(N²)
# ============================================================================
ax1 = plt.subplot(3, 3, 1)
systems = [3, 5, 10, 15, 20]
traditional = [(n * (n - 1)) // 2 for n in systems]
uis = [2 * n for n in systems]

ax1.plot(systems, traditional, 'r-o', linewidth=2.5, markersize=8, label='Traditional O(N²)')
ax1.plot(systems, uis, 'b-o', linewidth=2.5, markersize=8, label='UIS O(N)')
ax1.set_xlabel('Number of Systems', fontsize=10)
ax1.set_ylabel('Mappings Required', fontsize=10)
ax1.set_title('Schema Integration Complexity', fontsize=11, fontweight='bold')
ax1.legend(fontsize=9)
ax1.grid(True, alpha=0.3)
ax1.set_yscale('log')

# ============================================================================
# 2. Market Validity Rates
# ============================================================================
ax2 = plt.subplot(3, 3, 2)
markets = list(mcp_data["markets"].keys())
validity_rates = [mcp_data["markets"][m]["rate"] * 100 for m in markets]
colors = ['#ff6b6b' if r < 50 else '#4ecdc4' for r in validity_rates]

bars = ax2.bar(markets, validity_rates, color=colors, alpha=0.7, edgecolor='black', linewidth=1.5)
ax2.axhline(y=49.1, color='gray', linestyle='--', linewidth=2, label='Ecosystem Avg: 49.1%')
ax2.set_ylabel('Validity Rate (%)', fontsize=10)
ax2.set_title('MCP Market Validity Rates', fontsize=11, fontweight='bold')
ax2.set_ylim(0, 100)
ax2.tick_params(axis='x', rotation=45, labelsize=9)
ax2.legend(fontsize=8)
ax2.grid(True, alpha=0.2, axis='y')

# ============================================================================
# 3. Dependency Monoculture Risk
# ============================================================================
ax3 = plt.subplot(3, 3, 3)
languages = list(mcp_data["languages"].keys())
risk_scores = [mcp_data["languages"][l]["risk"] for l in languages]
server_counts = [mcp_data["languages"][l]["servers"] for l in languages]

# Size of bubbles represents server count
sizes = [s / 10 for s in server_counts]
scatter = ax3.scatter(languages, risk_scores, s=[s*30 for s in sizes], 
                      alpha=0.6, c=risk_scores, cmap='Reds', edgecolors='black', linewidth=1.5)

ax3.set_ylabel('Monoculture Risk Score', fontsize=10)
ax3.set_title('Language-Specific Supply Chain Risk', fontsize=11, fontweight='bold')
ax3.set_ylim(0, 100)
ax3.tick_params(axis='x', rotation=45, labelsize=9)
ax3.grid(True, alpha=0.2, axis='y')
plt.colorbar(scatter, ax=ax3, label='Risk')

# ============================================================================
# 4. Server Maintenance Distribution
# ============================================================================
ax4 = plt.subplot(3, 3, 4)
maintenance_labels = ['Active\n(≤90 days)', 'Recent\n(≤1 year)', 'Abandoned\n(>1 year)']
maintenance_values = [40.9, 37.2, 21.9]
colors_maint = ['#2ecc71', '#f39c12', '#e74c3c']

wedges, texts, autotexts = ax4.pie(maintenance_values, labels=maintenance_labels, 
                                     autopct='%1.1f%%', colors=colors_maint, 
                                     startangle=90, explode=(0.05, 0, 0.1))
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontweight('bold')
    autotext.set_fontsize(10)
ax4.set_title('Server Maintenance Status\n(8,060 servers)', fontsize=11, fontweight='bold')

# ============================================================================
# 5. Sensitive Data Exposure
# ============================================================================
ax5 = plt.subplot(3, 3, 5)
sensitive_cats = list(mcp_data["sensitive_apis"].keys())
sensitive_counts = list(mcp_data["sensitive_apis"].values())

bars = ax5.barh(sensitive_cats, sensitive_counts, color=['#e74c3c', '#c0392b', '#a93226', '#922b21'], 
                 alpha=0.8, edgecolor='black', linewidth=1.5)
ax5.set_xlabel('Server Count', fontsize=10)
ax5.set_title('Sensitive API Exposure\n(11.2% of ecosystem)', fontsize=11, fontweight='bold')
ax5.grid(True, alpha=0.2, axis='x')

for i, (cat, count) in enumerate(zip(sensitive_cats, sensitive_counts)):
    ax5.text(count + 20, i, f'{count}', va='center', fontsize=9, fontweight='bold')

# ============================================================================
# 6. Client Protocol Distribution
# ============================================================================
ax6 = plt.subplot(3, 3, 6)
protocols = list(mcp_data["protocols"].keys())
protocol_values = list(mcp_data["protocols"].values())
colors_proto = ['#3498db', '#e67e22', '#95a5a6']

wedges, texts, autotexts = ax6.pie(protocol_values, labels=protocols, 
                                     autopct='%1.1f%%', colors=colors_proto, 
                                     startangle=90)
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontweight('bold')
    autotext.set_fontsize(10)
ax6.set_title('MCP Client Protocol\nStandardization', fontsize=11, fontweight='bold')

# ============================================================================
# 7. Verification Pipeline Stages
# ============================================================================
ax7 = plt.subplot(3, 3, 7)
stages = ['Signature', 'Hash', 'Registry', 'Quality', 'Entity', 'Policy', 'Consensus']
stage_times = [24, 45, 38, 40, 59, 58, 59]
cumulative = np.cumsum(stage_times)

ax7.bar(range(len(stages)), stage_times, color='#3498db', alpha=0.7, edgecolor='black', linewidth=1.5)
ax7.plot(range(len(stages)), cumulative, 'r-o', linewidth=2.5, markersize=6, label='Cumulative')
ax7.set_xticks(range(len(stages)))
ax7.set_xticklabels(stages, rotation=45, ha='right', fontsize=9)
ax7.set_ylabel('Time (ms)', fontsize=10)
ax7.set_title('7-Stage Verification Pipeline\n(Total: 323ms)', fontsize=11, fontweight='bold')
ax7.legend(fontsize=8)
ax7.grid(True, alpha=0.2, axis='y')

# ============================================================================
# 8. Byzantine Consensus: Safety & Liveness
# ============================================================================
ax8 = plt.subplot(3, 3, 8)
configs = ['7N/2B', '7N/3B', '10N/3B', '13N/3B']
safety = [1, 0, 1, 1]
liveness = [1, 0, 1, 1]

x = np.arange(len(configs))
width = 0.35

bars1 = ax8.bar(x - width/2, safety, width, label='Safety', color='#2ecc71', 
                 alpha=0.8, edgecolor='black', linewidth=1.5)
bars2 = ax8.bar(x + width/2, liveness, width, label='Liveness', color='#3498db', 
                 alpha=0.8, edgecolor='black', linewidth=1.5)

ax8.set_ylabel('Property Satisfied', fontsize=10)
ax8.set_title('Byzantine Fault Tolerance\n(n ≥ 3f+1)', fontsize=11, fontweight='bold')
ax8.set_xticks(x)
ax8.set_xticklabels(configs, fontsize=9)
ax8.set_ylim(0, 1.3)
ax8.legend(fontsize=9)
ax8.set_yticks([0, 1])
ax8.set_yticklabels(['FAIL', 'PASS'])
ax8.grid(True, alpha=0.2, axis='y')

# ============================================================================
# 9. Test Execution Summary
# ============================================================================
ax9 = plt.subplot(3, 3, 9)
ax9.axis('off')

summary_text = f"""UIS BLOCKCHAIN VALIDATION SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Network: Sepolia Testnet
Phases: {test_results['phases']}/8 ✓
Contract: 0x8e15ed6dc1d23103...

Performance Metrics:
├─ Gas Used: {test_results['gas_total']:,}
├─ Avg/TX: {test_results['gas_average']:,}
└─ Cost: 0.0286 ETH

Query Processing:
├─ Queries: {test_results['queries']}
├─ Transformations: {test_results['transformations']}
└─ Consensus Tests: {test_results['consensus_tests']}

MCP Ecosystem vs UIS:
├─ Valid Servers: 8,656 / 17,630
├─ Validity Rate: 49.1%
├─ Markets Analyzed: 6
└─ Complexity Gain: 4.75× @ N=20
"""

ax9.text(0.05, 0.95, summary_text, transform=ax9.transAxes, 
         fontsize=9, verticalalignment='top', fontfamily='monospace',
         bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.3))

plt.suptitle('Comparative Analysis: UIS Architecture vs. MCP Ecosystem (Guo et al. 2025)', 
             fontsize=14, fontweight='bold', y=0.995)

plt.tight_layout(rect=[0, 0, 1, 0.99])
plt.savefig('/mnt/user-data/outputs/comparative_analysis.png', dpi=300, bbox_inches='tight')
print("✓ Graph saved: comparative_analysis.png")

plt.show()