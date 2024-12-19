# Build stage
FROM node:18-alpine AS builder
LABEL maintainer="DevOps Team <devops@memorable.com>"

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and TypeScript config
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code
RUN npm run build

# Production stage
FROM node:18-alpine
LABEL maintainer="DevOps Team <devops@memorable.com>"
LABEL com.memorable.service="print"
LABEL com.memorable.version="${VERSION}"
LABEL com.memorable.description="Print service for managing print jobs and printer network"

# Set working directory
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -S printservice && \
    adduser -S -G printservice printservice && \
    chown -R printservice:printservice /usr/src/app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built artifacts from builder stage
COPY --from=builder --chown=printservice:printservice /usr/src/app/dist ./dist

# Create necessary directories with proper permissions
RUN mkdir -p data temp && \
    chown -R printservice:printservice data temp && \
    chmod 755 data temp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV TZ=UTC

# Set resource limits
RUN apk add --no-cache tini

# Switch to non-root user
USER printservice

# Expose port
EXPOSE 3000

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Set default command
CMD ["node", "dist/app.js"]

# Volume configuration
VOLUME ["/usr/src/app/data", "/usr/src/app/temp"]

# Security configurations
STOPSIGNAL SIGTERM

# Resource limits (to be enforced by container runtime)
# CPU: 2
# Memory: 4G
# PIDs: 256
# Open files: 65536