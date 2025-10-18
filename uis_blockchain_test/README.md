# UIS Blockchain Validation Test Suite

## Universal Interoperable Schema - Proving Manuscript Concepts with Real Blockchain Transactions

This test suite validates the concepts presented in the manuscript "UIS: A Unified Blockchain-Orchestrated Architecture for Interoperable Model Context Protocols Across Heterogeneous Data Systems" through actual blockchain deployment and interaction on the Ethereum Sepolia testnet.

## 🎯 Purpose

This implementation proves the validity of the UIS architecture by demonstrating:

1. **O(N) Schema Integration Complexity** - Reducing integration overhead from quadratic to linear
2. **Byzantine Fault Tolerance** - Achieving consensus with n ≥ 3f + 1 nodes
3. **Multi-Stage Verification Pipeline** - 7-stage filtering and validation
4. **Schema Transformation Graph** - Bidirectional mappings with confidence scores
5. **Blockchain Orchestration** - Smart contract coordination without data migration
6. **Cryptographic Proof Anchoring** - IPFS integration for off-chain evidence
7. **Reputation Dynamics** - Weighted voting and economic incentives
8. **Cross-System Query Processing** - Heterogeneous data source integration

## 📁 Project Structure

```
uis-blockchain-test/
├── UISContracts.sol      # Main smart contract implementing UIS orchestration
├── UISTest.js            # JavaScript test suite matching manuscript concepts
├── package.json          # Node.js dependencies
├── hardhat.config.js     # Hardhat configuration for deployment
├── scripts/
│   └── deploy.js        # Deployment script for Sepolia
├── .env.example         # Environment variables template
└── uis_test_results/    # Test output directory (generated)
    ├── test_state.json
    ├── comprehensive_report.json
    └── summary.txt
```

## 🚀 Quick Start

### Prerequisites

- Node.js v16+ and npm
- Ethereum wallet with Sepolia ETH (≥0.1 ETH for testing)
- Infura account (free tier sufficient)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd uis-blockchain-test

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### Configuration

Edit `.env` file with your credentials:

```env
PRIVATE_KEY=your_private_key_without_0x
INFURA_PROJECT_ID=your_infura_project_id
```

### Deployment

1. **Compile the smart contract:**
```bash
npx hardhat compile
```

2. **Deploy to Sepolia:**
```bash
npx hardhat run scripts/deploy.js --network sepolia
```

3. **Update test configuration:**
   - Copy the deployed contract address
   - Open `UISTest.js`
   - Update `CONTRACT_ADDRESS` with your deployed address
   - Copy the ABI from `artifacts/contracts/UISOrchestrator.sol/UISOrchestrator.json`
   - Paste the ABI into `UISOrchestrator_ABI` array

### Running Tests

```bash
npm test
```

## 📊 Test Phases

The test suite executes 8 comprehensive phases:

### Phase 1: Data Source Registration
- Registers heterogeneous data sources (oracle, database, AI model)
- Establishes schema identifiers and version hashes
- Stakes ETH for Sybil resistance

### Phase 2: Schema Transformation Graph
- Creates bidirectional transformations to UIS
- Demonstrates O(N) vs O(N²) complexity reduction
- Registers confidence scores for mappings

### Phase 3: Query Processing Simulation
- Executes cross-system queries
- Tests query decomposition and routing
- Measures processing times and gas usage

### Phase 4: Byzantine Consensus Testing
- Validates n ≥ 3f + 1 fault tolerance
- Tests weighted voting mechanisms
- Calculates safety probabilities

### Phase 5: Verification Pipeline
- Tests 7-stage verification process:
  1. Signature verification
  2. Hash verification
  3. Registry validation
  4. Reputation checking
  5. Content policy filtering
  6. Consensus aggregation
  7. Proof assembly

### Phase 6: Reputation Dynamics
- Simulates reputation evolution
- Tests reward distribution
- Validates economic incentives

### Phase 7: Proof Anchoring
- Demonstrates IPFS evidence storage
- Calculates storage optimization (>90% reduction)
- Tests cryptographic commitments

### Phase 8: Performance Analysis
- Generates comprehensive metrics
- Validates manuscript claims
- Produces final reports

## 📈 Expected Results

### Performance Metrics
- **Gas Usage**: ~200,000-300,000 per major operation
- **Query Processing**: <100ms average
- **Consensus Achievement**: >85% success rate
- **Schema Efficiency**: 3-5x reduction in mappings

### Validation Outcomes
✅ O(N) schema integration complexity proven  
✅ Byzantine fault tolerance verified (f < n/3)  
✅ Multi-stage verification pipeline operational  
✅ Reputation-weighted consensus functional  
✅ Cryptographic proof anchoring demonstrated  

## 📝 Output Files

After successful execution, find results in `uis_test_results/`:

- **test_state.json**: Complete test execution state
- **comprehensive_report.json**: Detailed performance analysis
- **summary.txt**: Human-readable validation report

## 🔧 Troubleshooting

### Common Issues

1. **Insufficient Balance**
   - Ensure your account has ≥0.1 Sepolia ETH
   - Get test ETH from: https://sepoliafaucet.com

2. **Contract Not Deployed**
   - Verify deployment succeeded
   - Check contract address is correct
   - Ensure ABI matches deployed version

3. **Transaction Failures**
   - Increase gas limits in hardhat.config.js
   - Check network congestion
   - Verify private key format

### Debug Mode

For detailed logs, modify UISTest.js:
```javascript
this.web3.eth.handleRevert = true; // Show revert reasons
```

## 📚 Key Concepts Validated

### 1. Schema Integration Complexity

**Traditional Approach (O(N²)):**
```
For N systems: N(N-1)/2 pairwise mappings
Example: 10 systems = 45 mappings
```

**UIS Approach (O(N)):**
```
For N systems: 2N mappings (bidirectional to UIS)
Example: 10 systems = 20 mappings
Reduction: 55.6%
```

### 2. Byzantine Consensus Formula

```
Consensus achieved when:
∑(w_i) ≥ θ * ∑(w_total)
where θ = 2/3 for Byzantine tolerance
```

### 3. Verification Pipeline Stages

```
Input → Signature → Hash → Registry → Reputation → Policy → Consensus → Proof
```

## 🏗️ Architecture Components

### Smart Contract Functions

- `registerDataSource()`: Register heterogeneous sources
- `createQueryTask()`: Initiate cross-system queries
- `submitQueryResult()`: Submit query responses
- `registerTransformation()`: Create schema mappings
- `_checkConsensus()`: Byzantine fault tolerance
- `_distributeRewards()`: Economic incentives

### JavaScript Test Suite

- Network verification
- Transaction execution
- Performance monitoring
- Result validation
- Report generation

## 📖 Manuscript Reference

This implementation validates concepts from:

**"UIS: A Unified Blockchain-Orchestrated Architecture for Interoperable Model Context Protocols Across Heterogeneous Data Systems"**

Key contributions proven:
- Universal schema framework with O(N) complexity
- Schema Transformation Graph with confidence scores
- Distributed verification architecture
- Blockchain orchestration layer
- Complete query processing protocol

## 🤝 Contributing

Contributions are welcome! Please ensure:
- Code follows existing patterns
- Tests pass successfully
- Gas optimization is considered
- Documentation is updated

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Ethereum Foundation for blockchain infrastructure
- IPFS for decentralized storage
- Anthropic for Model Context Protocol specification
- Research community for Byzantine consensus algorithms

## 📞 Support

For issues or questions:
1. Check troubleshooting section
2. Review test logs in `uis_test_results/`
3. Open an issue with error details

---

**Note**: This is a research validation implementation. For production use, additional security audits and optimizations are recommended.
