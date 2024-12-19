# ===== Builder Stage =====
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and tools
RUN apk add --no-cache python3 make g++ 

# Copy package files first to leverage caching
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with strict security and offline mode
RUN npm ci --ignore-scripts --no-audit \
    && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ===== Production Stage =====
FROM node:18-alpine AS production

# Install security updates and basic tools
RUN apk update && apk upgrade \
    && apk add --no-cache wget curl tini \
    && rm -rf /var/cache/apk/*

# Create non-root user/group
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs package*.json ./

# Set secure permissions
RUN chmod -R 550 /app \
    && chmod -R 550 /app/dist \
    && chmod -R 500 /app/node_modules \
    && mkdir -p /app/logs \
    && chown -R nodejs:nodejs /app/logs \
    && chmod 750 /app/logs

# Configure environment
ENV NODE_ENV=production
ENV PORT=3001
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Set security headers
ENV NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_UNSAFE_PERM=false

# Expose application port
EXPOSE 3001

# Switch to non-root user
USER nodejs

# Health check configuration
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/health || exit 1

# Set resource constraints
LABEL com.memorable.resource.memory.limit="4g" \
      com.memorable.resource.memory.reservation="2g" \
      com.memorable.resource.cpu.limit="2" \
      com.memorable.resource.cpu.reservation="1"

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "dist/app.js"]