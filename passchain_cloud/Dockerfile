# Use the official Node.js runtime as base image
FROM node:18-slim

# Install curl and build essentials for canvas/sharp
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package*.json ./

# Install dependencies
RUN npm install --production --legacy-peer-deps

# Copy all service files. .env is intentionally excluded via .dockerignore —
# real config is injected at deploy time with `gcloud run deploy --set-env-vars`.
COPY . .

# Local scratch directories only — GCS is the source of truth for results/charts,
# these are just a best-effort local cache for debugging within a running instance.
RUN mkdir -p test_results charts logs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the service using your cloud:start script
CMD ["npm", "run", "cloud:start"]