# Stage 1: Builder
FROM node:18-alpine AS builder

# Set build environment variables
ENV NODE_ENV=development \
    PNPM_VERSION=8.6.0 \
    PYTHON_VERSION=3.11 \
    BUILD_DEPS="python3-dev build-base gcc"

# Install build essentials and pnpm
RUN apk add --no-cache $BUILD_DEPS && \
    npm install -g pnpm@$PNPM_VERSION && \
    python3 -m ensurepip && \
    pip3 install --no-cache-dir --upgrade pip setuptools wheel

# Set working directory
WORKDIR /app

# Copy package files for all services
COPY package.json pnpm-lock.yaml* ./
COPY services/*/package.json ./services/
COPY services/ai/requirements.txt ./services/ai/

# Install dependencies
RUN pnpm install --frozen-lockfile && \
    cd services/ai && pip3 install -r requirements.txt

# Copy source code
COPY . .

# Build all services
RUN pnpm run build

# Stage 2: Production
FROM node:18-alpine

# Set production environment variables
ENV NODE_ENV=production \
    PORT=4000 \
    PYTHON_VERSION=3.11 \
    MAX_OLD_SPACE_SIZE=4096

# Install production dependencies
RUN apk add --no-cache python3 curl && \
    python3 -m ensurepip && \
    pip3 install --no-cache-dir --upgrade pip

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built artifacts and dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/services/ai/requirements.txt ./services/ai/
COPY --from=builder --chown=nodejs:nodejs /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages

# Copy service-specific configurations
COPY --chown=nodejs:nodejs package.json ./

# Security hardening
RUN apk add --no-cache dumb-init && \
    chmod -R 550 /app && \
    chown -R nodejs:nodejs /app

# Set resource limits per service
ENV AUTH_SERVICE_CPU=2 \
    AUTH_SERVICE_MEMORY=4G \
    BOOK_SERVICE_CPU=2 \
    BOOK_SERVICE_MEMORY=4G \
    AI_SERVICE_CPU=8 \
    AI_SERVICE_MEMORY=16G \
    ORDER_SERVICE_CPU=2 \
    ORDER_SERVICE_MEMORY=4G \
    PRINT_SERVICE_CPU=2 \
    PRINT_SERVICE_MEMORY=4G

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Expose API port
EXPOSE 4000

# Use dumb-init as PID 1
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["node", "--max-old-space-size=4096", "dist/app.js"]

# Apply security labels
LABEL org.opencontainers.image.source="https://github.com/memorable/backend" \
      org.opencontainers.image.description="Memorable Backend Services" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Memorable" \
      org.opencontainers.image.licenses="Private" \
      security.selinux.type="container_runtime_t" \
      io.memorable.service.security.capabilities="NET_BIND_SERVICE"