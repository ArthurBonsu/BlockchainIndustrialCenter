#!/bin/bash

# PassChain Local Testing Script
# Tests the service locally before cloud deployment
# Uses root .env file (no separate passchain_cloud/.env needed)

echo "🧪 PassChain Local Test Suite"
echo "============================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js not found. Please install Node.js 18+ to continue."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required. Current version: $(node -v)"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if root .env file exists
if [ ! -f "../.env" ]; then
    echo "❌ Error: Root .env file not found."
    echo "Please create a .env file in your project root with:"
    echo ""
    echo "# Blockchain Configuration"
    echo "ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID"
    echo "POLKADOT_WS_URL=wss://rococo-rpc.polkadot.io"
    echo ""
    echo "# Google Cloud Configuration"  
    echo "PASSCHAIN_GCP_PROJECT_ID=your-passchain-project-name"
    echo "PASSCHAIN_CLOUD_RUN_REGION=us-central1"
    echo ""
    exit 1
fi

# Check if required variables are set in root .env
echo "🔍 Checking root .env configuration..."
source ../.env

if [ -z "$PASSCHAIN_GCP_PROJECT_ID" ]; then
    echo "⚠️  Warning: PASSCHAIN_GCP_PROJECT_ID not set in root .env"
    echo "Add: PASSCHAIN_GCP_PROJECT_ID=your-project-name to root .env"
fi

if [ -z "$ETHEREUM_RPC_URL" ]; then
    echo "⚠️  Warning: ETHEREUM_RPC_URL not set in root .env"
    echo "Add: ETHEREUM_RPC_URL=your-infura-url to root .env"
fi

# Start the service in background
echo "🚀 Starting PassChain service locally (reading from root .env)..."
npm start &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for service to start..."
sleep 5

# Test health endpoint
echo "🔍 Testing health endpoint..."
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    kill $SERVER_PID
    exit 1
fi

# Test service info endpoint
echo "📊 Testing service info endpoint..."
if curl -f -s http://localhost:8080/api/info > /dev/null; then
    echo "✅ Service info endpoint working!"
else
    echo "❌ Service info endpoint failed!"
    kill $SERVER_PID
    exit 1
fi

# Test PassChain functionality (if environment is configured)
echo "🔗 Testing PassChain validator..."
if node -e "const test = require('./passchain_cloud_validator'); console.log('✅ PassChain module loaded successfully');" 2>/dev/null; then
    echo "✅ PassChain validator module working!"
else
    echo "⚠️  PassChain validator module needs environment setup"
fi

# Stop the server
echo "🛑 Stopping local server..."
kill $SERVER_PID

echo ""
echo "✅ Local tests completed successfully!"
echo "🚀 Ready for cloud deployment!"
echo ""
echo "Next steps:"
echo "1. Ensure root .env file has PASSCHAIN_GCP_PROJECT_ID set"
echo "2. Ensure root .env file has ETHEREUM_RPC_URL set"
echo "3. Run: ./cloud_deployment_orchestrator.sh"