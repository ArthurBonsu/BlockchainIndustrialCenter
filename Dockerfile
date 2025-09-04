FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ALL the necessary files
COPY strebacom_cloud_config.py .
COPY strebacom_cloud_validator.py .
COPY strebacom_local_validator.py .

# Set environment variables
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Run the CONFIG file (the web service), NOT the validator
CMD ["python", "strebacom_cloud_config.py"]