# See++ Documentation

Welcome to the See++ documentation hub. This directory contains comprehensive guides for understanding, developing, and deploying the See++ C++ visualization platform.

## Documentation Overview

See++ is a web-based tool that helps students, educators, and developers understand C++ code execution through interactive visualizations. It compiles and runs C++ code in isolated environments, traces execution using a modified Valgrind, and presents memory states and program flow visually.

## Available Guides

### [Architecture Guide](./architecture.md)
**Start here to understand the system design**

- Complete system overview and component relationships
- Frontend, backend, and code runner architecture
- Data flow and execution workflow
- Security model and performance considerations
- Technology stack summary

---

### [Infrastructure Guide](./infrastructure.md)
**Deep dive into AWS infrastructure components**

- AWS services breakdown (ECS, S3, IAM, ECR, ALB, VPC)
- Environment-specific configurations
- Security policies and IAM roles
- Monitoring and logging setup
- Cost optimization strategies
- Troubleshooting infrastructure issues

---

### [Development Guide](./development.md)
**Everything you need for local development**

- Local setup with Docker Compose
- Development workflow and debugging
- Frontend (React) and backend (Node.js/TypeScript) development
- Code runner testing and troubleshooting
- Best practices and coding standards
- Performance optimization tips

---

### [Deployment Guide](./deployment.md)
**Step-by-step AWS deployment instructions**

- AWS Copilot setup and configuration
- Manual configuration steps for each environment
- IAM roles and security policies setup
- Secrets management and ECR configuration
- Verification and testing procedures
- Troubleshooting deployment issues

## Quick Navigation

### For New Contributors
1. Start with [Architecture Guide](./architecture.md) to understand the system
2. Follow [Development Guide](./development.md) to set up local environment
3. Make your changes and test locally

### For Deployment
1. Review [Infrastructure Guide](./infrastructure.md) to understand AWS components
2. Follow [Deployment Guide](./deployment.md) for step-by-step deployment
3. Use troubleshooting sections if issues arise

### For System Understanding
1. [Architecture Guide](./architecture.md) - High-level system design
2. [Infrastructure Guide](./infrastructure.md) - AWS infrastructure details
3. [Development Guide](./development.md) - Code organization and patterns

## Project Structure

```
SeePlusPlus/
├── frontend-legacy/          # React frontend (currently functional)
├── frontend/                 # New frontend (TypeScript, in development)
├── backend/                  # Node.js/TypeScript API server
├── code-runner/              # Isolated C++ execution environment
├── copilot/                  # AWS infrastructure as code
├── docs/                     # This documentation
│   ├── README.md            # This file
│   ├── architecture.md      # System design overview
│   ├── infrastructure.md    # AWS infrastructure guide
│   ├── development.md       # Local development guide
│   └── deployment.md        # AWS deployment guide
└── localdev.sh              # Local development script
```

## Key Technologies

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Frontend (Legacy)** | React 16.x, CodeMirror, Konva.js | Interactive code editor and visualization |
| **Frontend (New)** | React 19.x, Monaco Editor, TypeScript | Modern interactive interface |
| **Backend** | Node.js, TypeScript, Express | API server and orchestration |
| **Code Runner** | Docker, Modified Valgrind | Isolated C++ execution and tracing |
| **Infrastructure** | AWS (ECS, S3, ECR), Copilot | Scalable cloud deployment |
| **Development** | Docker Compose | Local development environment |

## Getting Started Quickly

### For Local Development
```bash
git clone https://github.com/knazir/SeePlusPlus.git
cd SeePlusPlus
./localdev.sh
# Navigate to http://localhost:8000
```

### For Understanding the System
Start with the [Architecture Guide](./architecture.md) which provides a comprehensive overview of how all components work together.

### For AWS Deployment
Ensure you have AWS CLI and Copilot CLI installed, then follow the [Deployment Guide](./deployment.md) step by step.

## Contributing to Documentation

When contributing to the See++ project, please:

1. **Update relevant documentation** if your changes affect system architecture, deployment, or development workflow
2. **Add new sections** to guides if you introduce new features or dependencies
3. **Test instructions** to ensure they work for new contributors
4. **Keep examples current** with actual configuration and code

## Support and Troubleshooting

Each guide contains troubleshooting sections for common issues:

- **Development Issues**: See [Development Guide - Troubleshooting](./development.md#troubleshooting)
- **Infrastructure Problems**: See [Infrastructure Guide - Troubleshooting](./infrastructure.md#troubleshooting)
- **Deployment Failures**: See [Deployment Guide - Troubleshooting](./deployment.md#troubleshooting)

For additional support:
- Check existing [GitHub Issues](https://github.com/knazir/SeePlusPlus/issues)
- Review [project discussions](https://github.com/knazir/SeePlusPlus/discussions)
- Refer to the main [README](../README.md) for project overview

## Roadmap and Future Documentation

As See++ evolves, documentation will be added for:

- **Testing Guide**: Comprehensive testing strategies and frameworks
- **Performance Guide**: Optimization techniques and monitoring
- **Security Guide**: Detailed security practices and threat modeling
- **Multi-Region Deployment**: Advanced deployment strategies
- **API Reference**: Complete backend API documentation
- **Component Library**: Frontend component documentation

---

For the latest updates, visit the [See++ GitHub repository](https://github.com/knazir/SeePlusPlus). 