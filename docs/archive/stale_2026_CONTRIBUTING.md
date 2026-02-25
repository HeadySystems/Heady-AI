# Contributing to Heady AI Platform

Thank you for your interest in contributing to Heady!

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/). Be respectful, constructive, and inclusive.

## Getting Started

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Install dependencies: `npm install`
4. Make your changes
5. Run tests: `npm test`
6. Submit a Pull Request

## Development Setup

```bash
git clone https://github.com/HeadySystems/Heady.git
cd Heady
npm install
cp .env.example .env
node heady-manager.js
```

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new AI node integration
fix: resolve rate limiter memory leak
docs: update architecture diagrams
chore: upgrade dependencies
security: rotate API key format
```

## Pull Request Requirements

- [ ] Code follows existing patterns
- [ ] All tests pass
- [ ] No competitor names in user-facing views (branding policy)
- [ ] Copyright header present on new files
- [ ] No hardcoded secrets or localhost references

## Architecture

See [Architecture Guide](docs/architecture/ARCHITECTURE.md) for system design.

## Questions?

Email: [e@headyconnection.org](mailto:e@headyconnection.org)
