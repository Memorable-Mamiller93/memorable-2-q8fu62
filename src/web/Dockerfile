# Stage 1: Build stage
FROM node:18-alpine AS builder

# Add build dependencies and security patches
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && apk upgrade --no-cache

# Create non-root user for build
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -G nodejs -u 1001

WORKDIR /app

# Copy package files for dependency installation
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies with exact versions and security audit
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code and configuration files
COPY --chown=nodejs:nodejs . .

# Set build-time environment variables
ENV NODE_ENV=production \
    CI=true \
    VITE_APP_ENV=production

# Build application with optimizations
RUN npm run build && \
    npm run clean

# Stage 2: Production stage
FROM nginx:1.25-alpine AS production

# Add security patches and cleanup
RUN apk upgrade --no-cache && \
    rm -rf /var/cache/apk/*

# Create nginx user and set permissions
RUN adduser -S -D -H -u 1001 -h /var/cache/nginx -s /sbin/nologin -G www-data nginx

# Copy nginx configuration
COPY --chown=nginx:nginx nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx nginx-security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Create cache and log directories with proper permissions
RUN mkdir -p /var/cache/nginx /var/log/nginx && \
    chown -R nginx:nginx /var/cache/nginx /var/log/nginx && \
    chmod -R 755 /var/cache/nginx /var/log/nginx

# Security hardening
RUN rm -rf /usr/share/nginx/html/index.html.default && \
    rm -f /etc/nginx/conf.d/default.conf

# Create nginx configuration
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    include /etc/nginx/security-headers.conf; \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript; \
    gzip_comp_level 6; \
    gzip_min_length 1000; \
    location / { \
        try_files $uri $uri/ /index.html; \
        expires 1h; \
        add_header Cache-Control "public, no-cache"; \
    } \
    location /static/ { \
        expires 30d; \
        add_header Cache-Control "public, immutable"; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy\n"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Create security headers configuration
RUN echo 'add_header X-Content-Type-Options "nosniff" always; \
    add_header X-Frame-Options "DENY" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header Referrer-Policy "strict-origin-when-cross-origin" always; \
    add_header Content-Security-Policy "default-src '\''self'\''; script-src '\''self'\'' '\''unsafe-inline'\'' '\''unsafe-eval'\''; style-src '\''self'\'' '\''unsafe-inline'\''; img-src '\''self'\'' data: https:; font-src '\''self'\'' data: https:;" always; \
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;' \
    > /etc/nginx/security-headers.conf

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]