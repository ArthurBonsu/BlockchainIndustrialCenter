# PassChain Google Cloud Project Setup Guide

## 📋 Step 1: Choose Your Google Cloud Project

Select a unique Google Cloud project ID for your PassChain deployment.

Recommended examples:

* `passchain-blockchain-test`
* `passchain-multichain-research`
* `blockchain-passchain-lab`
* `passchain-research-platform`
* `multichain-passchain-validator`

For this guide, we use:

```
passchain-multichain-research
```

---

# 🌟 Step 2: Create Google Cloud Project

## Option A: Google Cloud Console

1. Open:

```
https://console.cloud.google.com/
```

2. Select:

```
Select a project → New Project
```

3. Enter:

```
Project Name:
PassChain Multichain Research

Project ID:
passchain-multichain-research
```

4. Click **Create**

---

## Option B: Command Line

```bash
# Create project

gcloud projects create passchain-multichain-research \
--name="PassChain Multichain Research"


# Configure active project

gcloud config set project passchain-multichain-research
```

Enable billing from:

```
https://console.cloud.google.com/billing
```

Cloud Run requires an active billing account.

---

# 🔧 Step 3: Configure PassChain Environment

## 3.1 Configure Google Cloud Project Variables

### Windows PowerShell

```powershell
$env:PASSCHAIN_GCP_PROJECT_ID="passchain-multichain-research"
$env:GOOGLE_CLOUD_PROJECT="passchain-multichain-research"
```

### Linux / macOS

```bash
export PASSCHAIN_GCP_PROJECT_ID="passchain-multichain-research"
export GOOGLE_CLOUD_PROJECT="passchain-multichain-research"
```

---

# 3.2 Configure `.env`

Navigate to the PassChain cloud service directory:

```bash
cd passchain_cloud
```

Create environment file:

```bash
cp .env.template .env
```

Update:

```env
PASSCHAIN_GCP_PROJECT_ID=passchain-multichain-research

PASSCHAIN_RESULTS_BUCKET=passchain-test-results

PASSCHAIN_CHARTS_BUCKET=passchain-charts

ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID

POLKADOT_WS_URL=wss://rococo-rpc.polkadot.io
```

---

# 🚀 Step 4: Deploy PassChain Cloud Run Service

## 4.1 Authenticate and Enable APIs

```bash
# Select project

gcloud config set project passchain-multichain-research


# Authenticate

gcloud auth login


# Enable required APIs

gcloud services enable run.googleapis.com

gcloud services enable cloudbuild.googleapis.com

gcloud services enable containerregistry.googleapis.com

gcloud services enable storage.googleapis.com
```

Configure Docker:

```bash
gcloud auth configure-docker
```

---

# 4.2 Build PassChain Container

From:

```bash
cd passchain_cloud
```

Run:

```bash
gcloud builds submit \
--tag gcr.io/passchain-multichain-research/passchain-service:latest .
```

---

# 4.3 Deploy to Cloud Run

```bash
gcloud run deploy passchain-cloud-service \
--image gcr.io/passchain-multichain-research/passchain-service:latest \
--platform managed \
--region us-central1 \
--allow-unauthenticated \
--memory 2Gi \
--cpu 2 \
--timeout 900 \
--port 8080 \
--set-env-vars NODE_ENV=production,PASSCHAIN_GCP_PROJECT_ID=passchain-multichain-research
```

---

# 🧪 Step 5: Test Deployment

## Get Cloud Run URL

```bash
gcloud run services describe passchain-cloud-service \
--region=us-central1 \
--format="value(status.url)"
```

Example:

```
https://passchain-cloud-service-htqyibw6tq-uc.a.run.app
```

---

## Health Check

```bash
curl https://YOUR_SERVICE_URL/health
```

---

## API Information

```bash
curl https://YOUR_SERVICE_URL/api/info
```

---

## Start PassChain Validation

```bash
curl -X POST https://YOUR_SERVICE_URL/api/test/start
```

---

# Windows PowerShell Testing

Set service URL:

```powershell
$SERVICE_URL="https://passchain-cloud-service-htqyibw6tq-uc.a.run.app"
```

---

## Test 1: Health Check

```powershell
Write-Host "`n[TEST 1] Health Check"

Invoke-WebRequest `
-Uri "$SERVICE_URL/health" `
-Method GET |
Select-Object -ExpandProperty Content
```

---

## Test 2: API Information

```powershell
Write-Host "`n[TEST 2] API Info"

Invoke-WebRequest `
-Uri "$SERVICE_URL/api/info" `
-Method GET |
Select-Object -ExpandProperty Content
```

---

## Test 3: Start PassChain Test

```powershell
Write-Host "`n[TEST 3] Start Test"

Invoke-RestMethod `
-Uri "$SERVICE_URL/api/test/start" `
-Method POST
```

---

## Test 4: View Logs

```powershell
Write-Host "`n[TEST 4] Recent Logs"

gcloud run logs read passchain-cloud-service \
--region=us-central1 \
--limit=30
```

---

# ☁️ Download Test Results from Google Cloud Storage

PassChain automatically stores:

```
gs://passchain-test-results/
gs://passchain-charts/
```

Use **gcloud storage**:

---

## Create Local Directory

```powershell
mkdir "C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751"
```

---

## Download Results

```powershell
gcloud storage cp `
gs://passchain-test-results/passchain_mhvslo3l_xp751/result.json `
"C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751\"
```

---

## Download Charts

```powershell
gcloud storage cp -r `
gs://passchain-charts/passchain_mhvslo3l_xp751/* `
"C:\Users\Bonsu\Documents\passchain_results\passchain_mhvslo3l_xp751\"
```

---

# 📊 Expected Deployment Output

Successful deployment should display:

```
✅ PassChain Cloud Service Deployed Successfully!

==============================================

🌐 Service URL:
https://passchain-cloud-service-xxx-uc.a.run.app

🔍 Health Check:
https://passchain-cloud-service-xxx-uc.a.run.app/health

📊 Service Info:
https://passchain-cloud-service-xxx-uc.a.run.app/api/info

🧪 Start Test:
POST https://passchain-cloud-service-xxx-uc.a.run.app/api/test/start
```

---

# 🔗 Quick Reference Commands

## View Logs

```bash
gcloud run logs tail passchain-cloud-service \
--region=us-central1
```

---

## Update Service

```bash
gcloud run services update passchain-cloud-service \
--region=us-central1
```

---

## Delete Service

```bash
gcloud run services delete passchain-cloud-service \
--region=us-central1
```

---

## List Services

```bash
gcloud run services list
```

---

## Check Current Project

```bash
gcloud config get-value project
```

---

## Check Storage Buckets

```bash
gcloud storage buckets list
```

---

**Replace `passchain-multichain-research` with your actual Google Cloud project ID if different.**
