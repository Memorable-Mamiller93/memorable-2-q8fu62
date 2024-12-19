# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build dependencies and security updates
RUN apk update && \
    apk upgrade && \
    apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies including devDependencies for build
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production stage
FROM node:18-alpine

# Set production environment
ENV NODE_ENV=production
ENV PORT=3002

# Install security updates and runtime dependencies
RUN apk update && \
    apk upgrade && \
    apk add --no-cache curl tini && \
    addgroup -g 1001 nodejs && \
    adduser -u 1001 -G nodejs -s /bin/sh -D nodejs

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts and dependencies from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package*.json ./

# Set secure permissions
RUN chown -R nodejs:nodejs /usr/src/app && \
    chmod -R 550 /usr/src/app && \
    mkdir -p /usr/src/app/logs && \
    chown -R nodejs:nodejs /usr/src/app/logs && \
    chmod -R 660 /usr/src/app/logs

# Configure security options
RUN mkdir -p /tmp/memorable && \
    chown -R nodejs:nodejs /tmp/memorable && \
    chmod -R 1777 /tmp/memorable

# Set resource limits
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Switch to non-root user
USER nodejs

# Expose service port
EXPOSE 3002

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the service
CMD ["node", "dist/app.js"]