# -----------------------------------------------------------------------------
# Build Stage
# -----------------------------------------------------------------------------
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    build-base

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies with exact versions
RUN npm ci --ignore-scripts

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Run security audit
RUN npm audit

# -----------------------------------------------------------------------------
# Production Stage
# -----------------------------------------------------------------------------
FROM node:18-alpine

# Install Tini for proper signal handling
ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini-static /tini
RUN chmod +x /tini

# Install production dependencies
RUN apk add --no-cache \
    curl \
    && addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy production files from builder
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Set secure permissions
RUN chmod -R 550 /app \
    && chmod -R 550 /app/node_modules \
    && chmod -R 550 /app/dist

# Configure environment
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Expose API Gateway port
EXPOSE 3000

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use Tini as entrypoint
ENTRYPOINT ["/tini", "--"]

# Start the application
CMD ["node", "dist/app.js"]

# Build-time metadata
LABEL maintainer="Memorable Platform Team" \
    org.opencontainers.image.title="Memorable API Gateway" \
    org.opencontainers.image.description="API Gateway service for the Memorable platform" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.vendor="Memorable" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.source="https://github.com/memorable/gateway" \
    org.opencontainers.image.licenses="Private"