# Use Python 3.11 slim image as base
# python:3.11-slim version 2023-11
FROM python:3.11-slim

# Add metadata labels
LABEL maintainer="Memorable Team" \
      version="1.0" \
      description="AI Service for story and illustration generation" \
      security.credentials="non-root-user" \
      performance.sla="<30s response time"

# Create non-root user and group for security
RUN groupadd -r appuser && useradd -r -g appuser -s /sbin/nologin appuser

# Set working directory
WORKDIR /app

# Copy requirements file
COPY requirements.txt .

# Install dependencies and clean up in a single layer to minimize image size
# Install only required build dependencies and clean up afterwards
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        && \
    # Install Python packages
    pip install --no-cache-dir -r requirements.txt && \
    # Clean up
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /root/.cache/pip/*

# Copy application code with proper ownership
COPY --chown=appuser:appuser ./src .

# Set environment variables for optimization
ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    # Configure workers based on c5.2xlarge specs (8 vCPUs)
    WORKERS=4 \
    # Optimize worker lifecycle
    MAX_REQUESTS=10000 \
    MAX_REQUESTS_JITTER=1000 \
    # Set timeouts for SLA compliance
    TIMEOUT=300 \
    KEEP_ALIVE=5 \
    GRACEFUL_TIMEOUT=30 \
    # Security headers
    SECURE_HEADERS=true

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/cache && \
    chown -R appuser:appuser /app/logs /app/cache

# Expose application port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start application with optimized settings
CMD ["uvicorn", "app:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--timeout-keep-alive", "5", \
     "--limit-max-requests", "10000", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--log-config", "log_config.json"]