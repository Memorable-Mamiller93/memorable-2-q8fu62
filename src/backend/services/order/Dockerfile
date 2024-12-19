# Stage 1: Builder
FROM node:18-alpine AS builder

# Security: Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Set working directory with proper permissions
WORKDIR /usr/src/app
RUN chown appuser:appgroup /usr/src/app

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

# Copy package files with strict permissions
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup tsconfig.json ./

# Install dependencies with security checks
RUN npm ci --audit=true && \
    npm cache clean --force

# Copy source code with appropriate ownership
COPY --chown=appuser:appgroup . .

# Generate Prisma client with optimizations
RUN npx prisma generate

# Build TypeScript with production optimizations
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:18-alpine

# Security: Create non-root user
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup

# Set security-related environment variables
ENV NODE_ENV=production \
    PORT=3003 \
    NODE_OPTIONS="--max-old-space-size=4096" \
    TZ=UTC \
    PCI_LOG_LEVEL=info \
    SECURITY_HEADERS=strict

# Install production dependencies
RUN apk add --no-cache tini tzdata

# Set working directory with proper permissions
WORKDIR /usr/src/app
RUN chown appuser:appgroup /usr/src/app

# Copy production files with verification
COPY --chown=appuser:appgroup --from=builder /usr/src/app/package*.json ./
COPY --chown=appuser:appgroup --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=appuser:appgroup --from=builder /usr/src/app/dist ./dist
COPY --chown=appuser:appgroup --from=builder /usr/src/app/prisma ./prisma

# Set strict file permissions
RUN chmod -R 550 /usr/src/app && \
    chmod -R 500 /usr/src/app/node_modules && \
    chmod -R 400 /usr/src/app/dist

# Create and set permissions for log directory
RUN mkdir -p /usr/src/app/logs && \
    chown appuser:appgroup /usr/src/app/logs && \
    chmod 750 /usr/src/app/logs

# Configure security limits
RUN echo "appuser soft nofile 1024" >> /etc/security/limits.conf && \
    echo "appuser hard nofile 2048" >> /etc/security/limits.conf

# Set resource limits
RUN echo "* soft nproc 50" >> /etc/security/limits.conf && \
    echo "* hard nproc 100" >> /etc/security/limits.conf

# Switch to non-root user
USER appuser

# Health check configuration
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Container metadata
LABEL maintainer="Memorable DevOps Team" \
      version="${BUILD_VERSION:-latest}" \
      pci.compliant="true" \
      security.baseline="high" \
      org.opencontainers.image.source="https://github.com/memorable/order-service" \
      org.opencontainers.image.description="Order management and payment processing microservice"

# Expose service port
EXPOSE 3003

# Use tini as init process
ENTRYPOINT ["/sbin/tini", "--"]

# Start the service
CMD ["node", "--max-old-space-size=4096", "dist/app.js"]