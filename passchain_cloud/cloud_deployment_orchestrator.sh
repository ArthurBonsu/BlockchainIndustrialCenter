#!/bin/bash

# PassChain Cloud Deployment Orchestrator
# Deploys PassChain service to Google Cloud Run
# Reads configuration from root .env file using PASSCHAIN_GCP_PROJECT_ID

set -e  # Exit on any error

# Load environment variables from root .env file
if [ -f "../.env" ]; then
    source ../.env
else
    echo "❌ Error: Root .env file not found. Please ensure .env exists in project root."
    exit 1
fi

# Configuration - reads from root .env to avoid duplication
PROJECT_ID=${PASSCHAIN_GCP_PROJECT_ID:-""}
SERVICE_NAME="passchain-cloud-service"
REGION=${PASSCHAIN_CLOUD_RUN_REGION:-"us-central1"}
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🚀 PassChain Cloud Deployment Started"
echo "====================================="
echo "📋 Project: $PROJECT_ID (from PASSCHAIN_GCP_PROJECT_ID)"
echo "🏷️  Service: $SERVICE_NAME"
echo "🌍 Region: $REGION"
echo ""

# Validate required environment variables
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: PASSCHAIN_GCP_PROJECT_ID not set in root .env file."
    echo "Please add: PASSCHAIN_GCP_PROJECT_ID=your-passchain-project-name to your root .env file"
    exit 1
fi

if [ -z "$ETHEREUM_RPC_URL" ]; then
    echo "❌ Error: ETHEREUM_RPC_URL not set in root .env file."
    echo "Please add your Ethereum RPC URL to the root .env file"
    exit 1
fi

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker not found. Please install Docker."
    exit 1
fi

# Authenticate with gcloud (if not already authenticated)
echo "🔐 Checking authentication..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q "@"; then
    echo "Please authenticate with Google Cloud:"
    gcloud auth login
fi

# Set the project
echo "📋 Setting project to: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Buckets and permissions - do this BEFORE deploying, since a missing bucket or
# missing IAM role is the most common reason results/charts silently fail to upload
RESULTS_BUCKET=${PASSCHAIN_RESULTS_BUCKET:-"passchain-test-results"}
CHARTS_BUCKET=${PASSCHAIN_CHARTS_BUCKET:-"passchain-charts"}

echo "🪣 Ensuring GCS buckets exist..."
for BUCKET in "$RESULTS_BUCKET" "$CHARTS_BUCKET"; do
    if ! gcloud storage buckets describe "gs://$BUCKET" &> /dev/null; then
        echo "   Creating gs://$BUCKET in $REGION..."
        gcloud storage buckets create "gs://$BUCKET" --location="$REGION" --project="$PROJECT_ID"
    else
        echo "   ✅ gs://$BUCKET already exists"
    fi
done

# Find the service account Cloud Run will actually run as (defaults to the
# project's compute service account if none is configured)
RUNTIME_SA=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null)
if [ -z "$RUNTIME_SA" ]; then
    PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
    RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

echo "🔐 Granting $RUNTIME_SA write access to storage buckets..."
for BUCKET in "$RESULTS_BUCKET" "$CHARTS_BUCKET"; do
    gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" \
        --member="serviceAccount:$RUNTIME_SA" \
        --role="roles/storage.objectAdmin" \
        --quiet
done

# Build the Docker image
echo "🏗️  Building Docker image..."
docker build -t $IMAGE_NAME .

# Configure Docker for gcloud
echo "🔧 Configuring Docker authentication..."
gcloud auth configure-docker

# Push the image to Google Container Registry
echo "📤 Pushing image to Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run with environment variables from root .env
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --memory 2Gi \
    --cpu 2 \
    --concurrency 10 \
    --max-instances 5 \
    --timeout 900 \
    --port 8080 \
    --set-env-vars NODE_ENV=production,PASSCHAIN_GCP_PROJECT_ID=$PROJECT_ID,PASSCHAIN_RESULTS_BUCKET=$RESULTS_BUCKET,PASSCHAIN_CHARTS_BUCKET=$CHARTS_BUCKET,PASSCHAIN_CLOUD_RUN_REGION=$REGION \
    --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)")

echo ""
echo "✅ PassChain Cloud Service Deployed Successfully!"
echo "================================================"
echo "🌐 Service URL: $SERVICE_URL"
echo "🔍 Health Check: $SERVICE_URL/health"
echo "📊 Service Info: $SERVICE_URL/api/info"
echo "🧪 Start Test: POST $SERVICE_URL/api/test/start"
echo ""
echo "📖 API Documentation:"
echo "  GET  /health                     - Health check"
echo "  GET  /api/info                   - Service information"
echo "  POST /api/test/start             - Start PassChain test"
echo "  GET  /api/test/status/:testId    - Get test status"
echo "  GET  /api/results/:testId        - Get test results (JSON)"
echo "  GET  /api/charts/:testId         - Get charts (PNG)"
echo "  GET  /api/complete/:testId       - Get results + charts"
echo ""
echo "🔧 Management Commands:"
echo "  View logs: gcloud run logs tail $SERVICE_NAME --region=$REGION"
echo "  Update service: gcloud run services update $SERVICE_NAME --region=$REGION"
echo "  Delete service: gcloud run services delete $SERVICE_NAME --region=$REGION"
echo ""
echo "📋 Configuration Source: Root .env file"
echo "  Using PASSCHAIN_GCP_PROJECT_ID: $PROJECT_ID"
echo "  Using ETHEREUM_RPC_URL: ${ETHEREUM_RPC_URL:0:30}..."
echo ""

# Test the deployment
echo "🧪 Testing deployment..."
sleep 10  # Wait for service to start
if curl -f -s "$SERVICE_URL/health" > /dev/null; then
    echo "✅ Health check passed!"
    echo ""
    echo "🔗 Test PassChain functionality:"
    echo "curl -X POST $SERVICE_URL/api/test/start"
else
    echo "⚠️  Warning: Health check failed. Service may still be starting up."
fi

echo ""
echo "🎉 Deployment completed! Your PassChain service is live at:"
echo "$SERVICE_URL"