# Memorable - AI-Powered Children's Book Creation Platform

## Overview

Memorable is an enterprise-grade React.js frontend application that enables the creation of personalized children's books through AI-powered story generation and illustration. This platform serves as the user interface for parents, grandparents, educators, and gift-givers to create professional-quality personalized books.

![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)
![PNPM Version](https://img.shields.io/badge/pnpm-%3E%3D8.6.0-blue)
![React Version](https://img.shields.io/badge/react-18.2.0-blue)
![TypeScript Version](https://img.shields.io/badge/typescript-5.0.0-blue)

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Environment](#development-environment)
- [Architecture](#architecture)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Prerequisites

- Node.js >= 18.0.0 LTS
- pnpm >= 8.6.0
- Git >= 2.40.0
- VS Code (recommended)

### Required VS Code Extensions

- ESLint
- Prettier
- TypeScript + JavaScript
- Jest Runner
- EditorConfig
- GitLens

## Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd src/web
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Start development server:
```bash
pnpm dev
```

## Development Environment

### IDE Configuration

VS Code workspace settings are provided in `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Environment Configuration

The application uses the following environment variables:

```bash
VITE_API_URL=http://localhost:3000
VITE_AI_SERVICE_URL=http://localhost:3001
VITE_STRIPE_PUBLIC_KEY=pk_test_...
```

### Development Server

- Development server runs on `http://localhost:5173`
- Hot Module Replacement (HMR) enabled
- Proxy configuration available in `vite.config.ts`

## Architecture

### Component Architecture

```
src/
├── components/
│   ├── common/         # Reusable components
│   ├── features/       # Feature-specific components
│   └── layouts/        # Layout components
├── hooks/              # Custom React hooks
├── pages/              # Route components
├── services/           # API services
├── store/              # Redux store configuration
└── utils/              # Utility functions
```

### State Management

- Redux Toolkit for global state management
- RTK Query for API cache management
- React Context for theme and localization

### Routing

- React Router v6 with TypeScript
- Protected routes implementation
- Lazy loading for route components

## Security

### Authentication

- JWT-based authentication
- Secure token storage in HTTP-only cookies
- Automatic token refresh mechanism

### Authorization

- Role-based access control (RBAC)
- Route protection with auth guards
- API request interceptors

### Data Protection

- Input sanitization
- XSS prevention
- CSRF protection
- Content Security Policy (CSP)

## Testing

### Unit Testing

```bash
# Run unit tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Integration Testing

```bash
# Run integration tests
pnpm test:integration
```

### E2E Testing

```bash
# Run Cypress tests
pnpm test:e2e
```

## Deployment

### Build Process

```bash
# Create production build
pnpm build

# Preview production build
pnpm preview
```

### Environment Configurations

- `development` - Local development
- `staging` - Pre-production testing
- `production` - Production deployment

### CDN Integration

- Assets served through CloudFront
- Cache control headers
- Asset versioning

## Contributing

### Development Workflow

1. Create feature branch from `develop`
2. Implement changes with tests
3. Submit PR with description
4. Address review comments
5. Merge after approval

### Code Standards

- ESLint configuration
- Prettier formatting
- TypeScript strict mode
- Component documentation
- Test coverage requirements

### PR Guidelines

- Descriptive PR title
- Linked issue reference
- Screenshot/video for UI changes
- Test coverage report
- Breaking change notification

## Performance Optimization

- Code splitting
- Lazy loading
- Image optimization
- Bundle size analysis
- Performance monitoring

## Accessibility

- WCAG 2.1 Level AA compliance
- Semantic HTML
- ARIA attributes
- Keyboard navigation
- Screen reader support

## Support

For technical support or questions:

- Create an issue in the repository
- Contact the development team
- Check documentation in Confluence

## License

[License details here]

---

© 2023 Memorable. All rights reserved.