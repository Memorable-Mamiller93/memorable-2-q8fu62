# Contributing to Memorable

Welcome to the Memorable project! This document provides comprehensive guidelines for contributing to our AI-powered personalized children's book creation platform. We appreciate your interest in making Memorable better.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)

## Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inspiring community for all. Our Code of Conduct applies to all spaces managed by the Memorable project.

### Expected Behavior
- Use welcoming and inclusive language
- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other community members

### Reporting Issues
Report any unacceptable behavior to [conduct@memorable.com](mailto:conduct@memorable.com).

## Getting Started

### Prerequisites
Ensure you have the following installed:
- Node.js (v18.x)
- Python (v3.11+)
- Docker (v24.0+)
- pnpm (v8.6+)
- Git (v2.40+)

### Development Environment Setup

1. **IDE Setup**
   Install VS Code with the following extensions:
   - ESLint
   - Prettier
   - GitLens
   - Python
   - Docker

2. **Repository Setup**
   ```bash
   git clone https://github.com/memorable/memorable.git
   cd memorable
   pnpm install
   ```

3. **Environment Configuration**
   ```bash
   cp .env.example .env
   # Configure your environment variables
   ```

### Local Testing Setup
1. Start the development environment:
   ```bash
   docker-compose up -d
   pnpm dev
   ```

2. Access the application:
   - Frontend: http://localhost:3000
   - API: http://localhost:4000

### Troubleshooting Guide
Common issues and solutions are documented in our [Wiki](https://github.com/memorable/memorable/wiki/troubleshooting).

## Development Workflow

### Branch Naming Convention
Format: `{type}/{ticket-number}-{description}`

Types:
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes
- `chore/` - Maintenance tasks

Examples:
- `feature/MEM-123-add-theme-selector`
- `bugfix/MEM-456-fix-image-upload`

### Commit Message Format
Format: `{type}({scope}): {description}`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Examples:
```
feat(book-creator): add theme selection
fix(auth): resolve token expiration
```

### Pull Request Process
1. Create a PR with the title format: `{ticket-number}: {description}`
2. Fill out the PR template completely
3. Ensure all required checks pass:
   - Unit tests
   - Integration tests
   - Security scan
   - Lint check
   - Type check
   - Build check
4. Obtain at least one approval from required reviewers
5. Ensure branch is up to date with main

### Code Review Guidelines
- Review within 24 business hours
- Focus on:
  - Code correctness
  - Security implications
  - Performance impact
  - Test coverage
  - Documentation completeness

## Coding Standards

### TypeScript/JavaScript Guidelines
- Use TypeScript for all new code
- Follow ESLint recommended rules
- Use Prettier for formatting
- Document with JSDoc comments

### Python Standards
- Follow PEP 8
- Use type hints
- Document with docstrings
- Maximum line length: 88 characters

### Testing Requirements
- Minimum coverage requirements:
  - Lines: 80%
  - Functions: 80%
  - Branches: 75%
  - Statements: 80%

### Documentation Standards
- JSDoc for all public APIs
- README.md for all packages
- API documentation using OpenAPI/Swagger
- Inline comments for complex logic

### Accessibility Requirements
- Follow WCAG 2.1 Level AA standards
- Include ARIA labels
- Ensure keyboard navigation
- Support screen readers

### Internationalization Guidelines
- Use i18next for translations
- Support RTL layouts
- Use Unicode for character encoding
- Implement locale-specific formatting

## Testing Guidelines

### Unit Testing
- Use Jest for JavaScript/TypeScript
- Use pytest for Python
- Mock external dependencies
- Test edge cases
- Maintain 80% coverage minimum

### Integration Testing
- Test service interactions
- Verify API contracts
- Test database operations
- Validate event flows

### E2E Testing
- Use Cypress for frontend
- Test critical user journeys
- Verify third-party integrations
- Test payment flows

### Performance Testing
- Load testing with k6
- Benchmark API responses
- Monitor memory usage
- Test with production-like data

### Security Testing
- SAST with SonarQube
- DAST with OWASP ZAP
- Dependency scanning
- Regular penetration testing

### Accessibility Testing
- Automated testing with axe-core
- Manual screen reader testing
- Keyboard navigation testing
- Color contrast verification

## Security Guidelines

### Code Security Standards
- Input validation for all user data
- Output encoding for displayed data
- Secure session management
- Rate limiting implementation

### Dependency Management
- Regular dependency updates
- Security audit with `pnpm audit`
- Approved dependency list
- Version pinning

### Sensitive Data Handling
- No secrets in code
- Use environment variables
- Encrypt sensitive data
- Follow GDPR requirements

### Security Review Process
- Security review for all PRs
- Weekly vulnerability scans
- Monthly security updates
- Quarterly penetration testing

### Vulnerability Reporting
Report security vulnerabilities to [security@memorable.com](mailto:security@memorable.com)