# PassChain Google Cloud Project Setup Guide

## 📋 Step 1: Choose Your Project Name

Pick a unique name for your PassChain project. Good options:
- `passchain-blockchain-test`
- `passchain-multichain-research`  
- `blockchain-passchain-lab`
- `passchain-research-platform`
- `multichain-passchain-validator`

**For this guide, I'll use `passchain-multichain-research` as an example.**

## 🌟 Step 2: Create New Google Cloud Project

### Option A: Via Google Cloud Console
1. Go to: https://console.cloud.google.com/
2. Click "Select a project" → "New Project"
3. Project name: `PassChain Multichain Research`
4. Project ID: `passchain-multichain-research` (or your chosen name)
5. Click "Create"

### Option B: Via Command Line
```bash
# Create new project
gcloud projects create passchain-multichain-research --name="PassChain Multichain Research"

# Set as active project
gcloud config set project passchain-multichain-research

# Enable billing (required for Cloud Run)
# You'll need to do this via console: https://console.cloud.google.com/billing
```

## 🔧 Step 3: Configure Your Environment

Update your deployment files with the new project name:

### 3.1 Update Environment Variables
```bash
# Windows PowerShell
$env:GCP_PROJECT_ID = "passchain-multichain-research"
$env:GOOGLE_CLOUD_PROJECT = "passchain-multichain-research"

# Linux/Mac
export GCP_PROJECT_ID="passchain-multichain-research"
export GOOGLE_CLOUD_PROJECT="passchain-multichain-research"
```

### 3.2 Update .env File
```bash
cd passchain_cloud
cp .env.template .env

# Edit .env file and update:
# GCP_PROJECT_ID=passchain-multichain-research
# ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
# POLKADOT_WS_URL=wss://rococo-rpc.polkadot.io
```

## 🚀 Step 4: Deploy PassChain to Cloud Run

### 4.1 Enable APIs and Authenticate
```bash
# Set project
gcloud config set project passchain-multichain-research

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Configure Docker
gcloud auth configure-docker
```

### 4.2 Deploy Using Orchestrator Script
```bash
cd passchain_cloud

# Update deployment script with your project
export GCP_PROJECT_ID="passchain-multichain-research"

# Run deployment
./cloud_deployment_orchestrator.sh
```

### 4.3 Manual Deployment (Alternative)
```bash
# Build container
gcloud builds submit --tag gcr.io/passchain-multichain-research/passchain-cloud-service:latest .

# Deploy to Cloud Run
gcloud run deploy passchain-cloud-service \
    --image gcr.io/passchain-multichain-research/passchain-cloud-service:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --timeout 900 \
    --port 8080 \
    --set-env-vars NODE_ENV=production
```

Should rather be 
gcloud run deploy passchain-cloud-service --image gcr.io/passchain-multichain-research/passchain-service:latest --platform managed --region us-central1 --allow-unauthenticated --memory 2Gi --cpu 2 --timeout 900 --port 8080 --set-env-vars NODE_ENV=production

## 🧪 Step 5: Test Your Deployment

```bash
# Get service URL
gcloud run services describe passchain-cloud-service --region=us-central1 --format="value(status.url)"

# Test health endpoint
curl https://your-service-url/health

# Start PassChain test
curl -X POST https://your-service-url/api/test/start
```

# Set the service URL
$SERVICE_URL = "https://passchain-cloud-service-htqyibw6tq-uc.a.run.app"

# Test 1: Health Check
Write-Host "`n[TEST 1] Health Check" -ForegroundColor Cyan
Invoke-WebRequest -Uri "$SERVICE_URL/health" -Method GET | Select-Object -ExpandProperty Content

# Test 2: API Info
Write-Host "`n[TEST 2] API Info" -ForegroundColor Cyan
Invoke-WebRequest -Uri "$SERVICE_URL/api/info" -Method GET | Select-Object -ExpandProperty Content

# Test 3: Start PassChain Test
Write-Host "`n[TEST 3] Start Test" -ForegroundColor Cyan
Invoke-RestMethod -Uri "$SERVICE_URL/api/test/start" -Method POST

# Test 4: View Logs
Write-Host "`n[TEST 4] Recent Logs" -ForegroundColor Cyan
gcloud run logs read passchain-cloud-service --region=us-central1 --limit=30

curl http://localhost:8080/api/results/{testId}/download

gsutil cp gs://passchain-test-results/passchain_mhvslo3l_xp751/result.json "C:\Users\Bonsu\Documents\passchain_results\"

gsutil cp -r gs://passchain-charts/passchain_mhvslo3l_xp751/* "C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751\"

# Create directory
mkdir "C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751"

# Download results
gsutil cp gs://passchain-test-results/passchain_mhvslo3l_xp751/result.json "C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751\"

# Download charts
gsutil cp -r gs://passchain-charts/passchain_mhvslo3l_xp751/* "C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751\"


## 📊 Expected Output

After successful deployment:
```
✅ PassChain Cloud Service Deployed Successfully!
================================================
🌐 Service URL: https://passchain-cloud-service-xxx-uc.a.run.app
🔍 Health Check: https://passchain-cloud-service-xxx-uc.a.run.app/health
📊 Service Info: https://passchain-cloud-service-xxx-uc.a.run.app/api/info
🧪 Start Test: POST https://passchain-cloud-service-xxx-uc.a.run.app/api/test/start
```



## 🔗 Quick Reference Commands

```bash
# View logs
gcloud run logs tail passchain-cloud-service --region=us-central1

# Update service
gcloud run services update passchain-cloud-service --region=us-central1

# Delete service  
gcloud run services delete passchain-cloud-service --region=us-central1

# List all services
gcloud run services list
```

---

**Replace `passchain-multichain-research` with your chosen project name throughout!** 🎯