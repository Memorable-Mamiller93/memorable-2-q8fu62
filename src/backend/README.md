# Memorable Backend Monorepo

## Overview

Memorable is an AI-powered children's book creation platform that leverages microservices architecture to deliver a scalable, resilient, and maintainable system. This monorepo contains all backend services required to power the platform.

### Architecture

The system implements a microservices architecture with the following core services:

- **API Gateway**: Request routing and API management (Node.js/Express)
- **Auth Service**: Authentication and authorization (Node.js)
- **Book Service**: Book creation and management (Python/Flask)
- **AI Service**: Story and illustration generation (Python/Flask)
- **Order Service**: Order processing and management (Node.js)
- **Print Service**: Print job coordination (Node.js)

### Technology Stack

- **Runtime**: Node.js 18 LTS, Python 3.11+
- **Frameworks**: Express.js 4.18+, Flask 2.3+
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7.0+
- **Message Queue**: RabbitMQ 3.12+
- **Container Runtime**: Docker 24.0+
- **Orchestration**: AWS ECS/Fargate

## Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- Node.js 18 LTS
- Python 3.11+
- pnpm 8.6+
- AWS CLI 2.0+
- PostgreSQL 15+ (local development)
- Redis 7.0+ (local development)

## Getting Started

### Repository Setup

1. Clone the repository:
```bash
git clone git@github.com:memorable/backend.git
cd backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Copy environment template:
```bash
cp .env.example .env
```

4. Configure environment variables:
```bash
# Core
NODE_ENV=development
API_PORT=3000
LOG_LEVEL=debug

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=memorable
POSTGRES_USER=postgres
POSTGRES_PASSWORD=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Services
AUTH_SERVICE_PORT=3001
BOOK_SERVICE_PORT=3002
AI_SERVICE_PORT=3003
ORDER_SERVICE_PORT=3004
PRINT_SERVICE_PORT=3005

# External APIs
OPENAI_API_KEY=your_key_here
STABLE_DIFFUSION_API_KEY=your_key_here
STRIPE_API_KEY=your_key_here
```

### Local Development

1. Start infrastructure services:
```bash
docker-compose up -d postgres redis rabbitmq
```

2. Start development servers:
```bash
# Terminal 1 - API Gateway
pnpm run dev:gateway

# Terminal 2 - Auth Service
pnpm run dev:auth

# Terminal 3 - Book Service
pnpm run dev:book

# Terminal 4 - AI Service
pnpm run dev:ai

# Terminal 5 - Order Service
pnpm run dev:order

# Terminal 6 - Print Service
pnpm run dev:print
```

## Development Guidelines

### Code Standards

- **TypeScript**: Strict mode enabled
- **Python**: Type hints required
- **Linting**: ESLint + Prettier for Node.js, Black + isort for Python
- **Testing**: Jest for Node.js, Pytest for Python
- **Coverage**: Minimum 80% test coverage required

### API Documentation

All services must maintain OpenAPI 3.0 specifications:

```bash
# Generate API documentation
pnpm run docs:generate

# View API documentation
pnpm run docs:serve
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration
```

## Deployment

### Container Build

```bash
# Build all services
pnpm run build:containers

# Build specific service
pnpm run build:container --service=auth
```

### AWS Deployment

```bash
# Deploy to staging
pnpm run deploy:staging

# Deploy to production
pnpm run deploy:production
```

### Infrastructure Scaling

Default resource allocation per service:

| Service | CPU | Memory | Min Instances | Max Instances |
|---------|-----|--------|---------------|---------------|
| Gateway | 1.0 | 2GB    | 2             | 10            |
| Auth    | 1.0 | 2GB    | 2             | 8             |
| Book    | 2.0 | 4GB    | 2             | 8             |
| AI      | 4.0 | 8GB    | 2             | 6             |
| Order   | 1.0 | 2GB    | 2             | 8             |
| Print   | 1.0 | 2GB    | 2             | 6             |

## Monitoring

### Health Checks

Each service exposes health endpoints:

- `/health/live`: Liveness probe
- `/health/ready`: Readiness probe
- `/metrics`: Prometheus metrics

### Logging

Structured JSON logging with the following levels:

```typescript
{
  level: 'info' | 'warn' | 'error' | 'debug',
  service: string,
  timestamp: string,
  traceId: string,
  message: string,
  metadata?: Record<string, unknown>
}
```

### Metrics

Key metrics tracked per service:

- Request rate and latency
- Error rate and types
- Resource utilization
- Business metrics (books created, orders processed)
- AI generation metrics

## Security

### API Authentication

Services use JWT-based authentication with the following claims:

```typescript
{
  sub: string;        // Subject (user ID)
  scope: string[];    // Permission scopes
  iat: number;        // Issued at
  exp: number;        // Expiration
  iss: string;        // Issuer
}
```

### Service-to-Service Communication

Internal service communication uses mTLS with certificate rotation:

```bash
# Generate service certificates
pnpm run security:generate-certs

# Rotate certificates
pnpm run security:rotate-certs
```

## Troubleshooting

### Common Issues

1. Database Connection Issues:
```bash
# Check database connectivity
pnpm run db:check-connection

# Reset database
pnpm run db:reset
```

2. Service Discovery Problems:
```bash
# Check service health
pnpm run health:check-all

# View service logs
pnpm run logs:service --name=auth
```

### Debug Mode

Enable debug logging:

```bash
# Set environment
export LOG_LEVEL=debug

# Start service with debugging
pnpm run dev:gateway --debug
```

## Contributing

1. Branch naming convention:
   - Feature: `feature/description`
   - Bug fix: `fix/description`
   - Hotfix: `hotfix/description`

2. Commit message format:
   ```
   type(scope): description
   
   [optional body]
   
   [optional footer]
   ```

3. Pull request requirements:
   - Passing tests
   - Updated documentation
   - Code review approval
   - No security vulnerabilities

## License

Copyright © 2023 Memorable. All rights reserved.