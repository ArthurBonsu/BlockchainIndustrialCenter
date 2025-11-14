# PassChain Cloud Service

Enhanced PassChain Multi-Blockchain Test Suite deployed on Google Cloud Run. This service provides REST API access to the comprehensive PassChain testing functionality including real blockchain connectivity, threat modeling, and cross-chain analysis.

## Features

- **Multi-Blockchain Connectivity**: Real connections to Ethereum Sepolia and Polkadot Rococo testnets
- **Comprehensive Threat Modeling**: 6 critical threat models including MEV attacks, Sybil resistance, and component composition vulnerabilities
- **Cross-Chain Bridge Testing**: Real cross-chain transaction analysis
- **Performance Metrics**: Detailed latency, throughput, and cost analysis
- **Cloud-Native Architecture**: Designed for Google Cloud Run with auto-scaling
- **REST API**: Easy integration with external systems

## Quick Start

### Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed and configured
3. **Docker** installed
4. **Blockchain RPC Access**:
   - Ethereum Sepolia RPC URL (e.g., from Infura, Alchemy, or Ankr)
   - Polkadot Rococo WebSocket URL

### Deployment Steps

1. **Clone and Setup**:
```bash
cd passchain_cloud
cp .env.template .env
# Edit .env with your configuration
```

2. **Set Environment Variables**:
```bash
export PROJECT_ID="your-gcp-project-id"
# Edit .env file with your RPC endpoints
```

3. **Deploy to Cloud Run**:
```bash
./cloud_deployment_orchestrator.sh
```

4. **Test the Deployment**:
```bash
# Get your service URL from deployment output
curl https://your-service-url/health
```

## API Endpoints

### Service Information
```bash
GET /health                     # Health check
GET /api/info                   # Service info and capabilities
```

### Test Management
```bash
POST /api/test/start            # Start PassChain test suite
GET /api/test/status/:testId    # Get test progress and status
GET /api/test/results/:testId   # Get complete test results
POST /api/test/stop/:testId     # Stop a running test
```

### Metrics and Analysis
```bash
GET /api/metrics/latest         # Get latest performance metrics
GET /api/threats/analysis       # Get threat modeling results
```

## Usage Examples

### Starting a Test
```bash
curl -X POST https://your-service-url/api/test/start
```

Response:
```json
{
  "testId": "passchain_abc123_xyz789",
  "status": "started",
  "message": "PassChain test suite initiated",
  "startTime": "2025-01-13T10:00:00.000Z",
  "estimatedDuration": "2-5 minutes"
}
```

### Checking Test Status
```bash
curl https://your-service-url/api/test/status/passchain_abc123_xyz789
```

Response:
```json
{
  "testId": "passchain_abc123_xyz789",
  "status": "running",
  "phase": "cross-chain-testing",
  "startTime": "2025-01-13T10:00:00.000Z",
  "runningTime": 180000,
  "progress": "Testing cross-chain bridges..."
}
```

### Getting Test Results
```bash
curl https://your-service-url/api/test/results/passchain_abc123_xyz789
```

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `ETHEREUM_RPC_URL` | Ethereum Sepolia RPC endpoint | Yes | - |
| `POLKADOT_WS_URL` | Polkadot Rococo WebSocket URL | Yes | `wss://rococo-rpc.polkadot.io` |
| `PORT` | Server port | No | `8080` |
| `NODE_ENV` | Environment mode | No | `production` |
| `GCP_PROJECT_ID` | Google Cloud Project ID | Yes | - |

### Blockchain Networks

- **Ethereum**: Sepolia Testnet
- **Polkadot**: Rococo Testnet

### Contract Addresses (Sepolia)

- **AssetTransfer**: `0x10906193b9c3a0d5ea7251047c55f5398d6d4990`
- **ConfidenceScoreCalculator**: `0xea2b8197b9c1fb936cdfcf6633c1837fc9726e5c`
- **PaceChainChannel**: `0xe75bfd5ba206ed5c059efeb0dd1c603f03c6553c`
- **SpeculativeTransaction**: `0x9eaac685f82cfd9e9966a1819bc8206a6fe602ca`

## Test Phases

The PassChain test suite runs through five comprehensive phases:

1. **Phase 1: Blockchain Connectivity**
   - Connect to Ethereum Sepolia
   - Connect to Polkadot Rococo
   - Verify contract accessibility

2. **Phase 2: Intra-Chain Performance**
   - Test speculative transactions
   - Test confirmable transactions
   - Measure latency and throughput

3. **Phase 3: Cross-Chain Bridge Testing**
   - Test Ethereum ↔ Polkadot bridges
   - Measure cross-chain latency
   - Analyze bridge reliability

4. **Phase 4: Threat Modeling**
   - MEV attack analysis
   - Sybil resistance testing
   - Eclipse attack scenarios
   - Reputation system vulnerabilities
   - Component composition security
   - Network desynchronization analysis

5. **Phase 5: Comprehensive Reporting**
   - Generate detailed metrics
   - Compile threat analysis
   - Provide recommendations

## Monitoring and Logs

### View Service Logs
```bash
gcloud run logs tail passchain-cloud-service --region=us-central1
```

### Service Metrics
The service automatically collects and exposes metrics including:
- Connection latencies
- Transaction processing times
- Cross-chain bridge performance
- Threat detection events
- System resource usage

## Security Considerations

1. **API Access**: Service is deployed with public access for testing. For production, implement authentication.
2. **Environment Variables**: Store sensitive data in Google Secret Manager.
3. **Rate Limiting**: Consider implementing rate limiting for production use.
4. **Network Security**: Configure VPC and firewall rules as needed.

## Troubleshooting

### Common Issues

1. **Deployment Fails**: Check GCP project permissions and enabled APIs
2. **Blockchain Connection Issues**: Verify RPC URLs and network connectivity
3. **Test Timeouts**: Check blockchain network congestion
4. **Memory Issues**: Increase Cloud Run memory allocation

### Support Commands

```bash
# View deployment status
gcloud run services describe passchain-cloud-service --region=us-central1

# Update environment variables
gcloud run services update passchain-cloud-service \
  --set-env-vars ETHEREUM_RPC_URL=new-url \
  --region=us-central1

# Scale service
gcloud run services update passchain-cloud-service \
  --max-instances=10 \
  --region=us-central1
```

## Development

### Local Testing
```bash
npm install
cp .env.template .env
# Edit .env with your configuration
npm start
```

### Running Tests Locally
```bash
npm test
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Client App    │───▶│  PassChain API   │───▶│  Blockchain     │
│                 │    │  (Cloud Run)     │    │  Networks       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  Test Results    │
                       │  Storage         │
                       └──────────────────┘
```

## Cost Estimation

- **Cloud Run**: Pay-per-request, typically $0.01-$0.10 per test
- **Networking**: Minimal for blockchain RPC calls
- **Storage**: Temporary result storage, minimal cost

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review Cloud Run logs
3. Verify blockchain network status
4. Open an issue in the repository

---

**Note**: This service connects to live blockchain testnets. Ensure you have sufficient testnet tokens for comprehensive testing.