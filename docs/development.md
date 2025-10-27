# See++ Local Development Guide

This guide covers everything you need to know to set up, run, and develop See++ locally using Docker Compose.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Docker Desktop**: [Download here](https://www.docker.com/products/docker-desktop/)
- **Git**: For cloning the repository
- **Text Editor/IDE**: VS Code, IntelliJ, or your preferred editor

### Optional (for AWS deployment)
- **AWS CLI**: For deploying to AWS environments
- **AWS Copilot CLI**: For infrastructure management

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/knazir/SeePlusPlus.git
cd SeePlusPlus
```

### 2. Environment Configuration

Create a `.env` file in the project root:

```bash
cp .env.example .env  # If .env.example exists
# OR create manually:
touch .env
```

**Required Environment Variables** (for local development):
```bash
# Local Development Configuration
EXEC_MODE=local
PORT=3000
USER_CODE_FILE_PREFIX=main
TRACESTORE_NAME=local-traces

# AWS Configuration (only needed for deployment)
AWS_REGION=us-west-2
AWS_ACCOUNT_ID=your-account-id
ECR_REPO=your-ecr-repo-url
```

### 3. Start the Application

```bash
./localdev.sh
```

This command will:
- Build all Docker images
- Start all services
- Make the application available at `http://localhost:8000`

## Development Workflow

### Using the localdev.sh Script

The `localdev.sh` script provides a comprehensive development workflow:

#### Basic Commands

```bash
# Start all services (default)
./localdev.sh up

# Stop all services
./localdev.sh down

# Restart services without rebuilding
./localdev.sh restart

# Rebuild and restart everything
./localdev.sh rebuild

# Build specific service
./localdev.sh build backend
./localdev.sh build frontend-legacy

# Clean up everything (containers, images, volumes)
./localdev.sh clean
```

#### Debugging Commands

```bash
# View logs (last 50 lines)
./localdev.sh logs backend
./localdev.sh logs frontend-legacy

# Stream logs in real-time
./localdev.sh logs backend --tail
./localdev.sh logs frontend-legacy --tail

# Open shell in running container
./localdev.sh exec backend
./localdev.sh exec frontend-legacy
```

#### Help
```bash
./localdev.sh help
```

### Service Architecture

When running locally, you'll have these services:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Code Runner    │
│  (Legacy)       │    │                 │    │                 │
│ localhost:8000  │◄──►│ localhost:3000  │◄──►│   (on-demand)   │
│  (New)          │    │                 │    │                 │
│ localhost:8080  │    │                 │    │                 │
│                 │    │                 │    │                 │
│ React Dev Server│    │ Node.js/Express │    │ Docker Container│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Frontend Development (React)

**Locations**: 
- `frontend-legacy/` (currently functional - main production)
- `frontend/` (under development - new implementation)

**Development Servers**: 
- Legacy: `http://localhost:8000`
- New: `http://localhost:8080` (when running)

**Key Features**:
- Hot reload for code changes
- Live code editor with syntax highlighting (CodeMirror in legacy, Monaco Editor in new)
- Real-time visualization updates
- Integrated debugging tools

**Technology Stack**:
- **Legacy**: React 16.x, CodeMirror, Konva.js, JavaScript/JSX
- **New**: React 19.x, Monaco Editor, TypeScript

**Development Tips**:
- Changes to React components auto-reload
- Console errors appear in browser developer tools
- API calls go to `http://localhost:3000/api`
- The new frontend is under active development - check with maintainers for current status

**File Structure** (Legacy):
```
frontend-legacy/
├── src/
│   ├── App.jsx              # Main application component
│   ├── editor/
│   │   └── Ide.jsx          # Code editor component
│   ├── visualization/
│   │   ├── Visualization.jsx # Main visualization
│   │   └── Output.jsx       # Output display
│   ├── utils/
│   │   ├── Api.js           # Backend communication
│   │   └── VisualizationTool.js # Visualization logic
│   └── components/          # Reusable components
├── package.json             # Dependencies and scripts
└── Dockerfile.dev           # Development container config
```

**File Structure** (New):
```
frontend/
├── src/                     # TypeScript source files
├── public/                  # Static assets
├── package.json             # Modern React dependencies
├── tsconfig.json            # TypeScript configuration
└── Dockerfile.dev           # Development container config
```

**Note**: The new frontend (`frontend/`) uses modern React patterns, TypeScript, and Monaco Editor instead of CodeMirror. It's configured as a separate service that can be deployed alongside the legacy frontend.

### Backend Development (Node.js/TypeScript)

**Location**: `backend/`

**Development Server**: `http://localhost:3000`

**Key Features**:
- TypeScript compilation with hot reload
- Automatic restart on code changes (nodemon)
- Local Docker runner for code execution
- Direct file system access for debugging

**Development Tips**:
- Changes auto-restart the server
- Logs appear in terminal or via `./localdev.sh logs backend --tail`
- Code execution uses local Docker containers
- Debug with `console.log()` or your preferred debugger

**File Structure**:
```
backend/
├── src/
│   ├── index.ts                # Main Express server
│   ├── runners/
│   │   ├── runner.interface.ts # Common interface
│   │   ├── local.ts            # Local Docker runner
│   │   ├── lambda.ts           # AWS Lambda runner
│   │   └── index.ts            # Runner factory
│   ├── valgrind_utils.ts       # Trace processing
│   └── parse_vg_trace.ts       # Valgrind parser
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
└── Dockerfile.dev              # Development container config
```

### Code Runner Development

**Location**: `code-runner/`

**Key Components**:
- Modified Valgrind for execution tracing
- Compilation and execution scripts
- Docker container configuration

**Testing Code Runner**:
1. The code runner image is built automatically
2. It's triggered when you submit code via the frontend
3. Execution happens in isolated Docker containers
4. Results are stored in `/tmp/spp-usercode/` locally

## Docker Compose Configuration

The `docker-compose.yml` defines the complete local environment:

### Services

#### Frontend (frontend-legacy)
- **Port**: 8000
- **Build**: `frontend-legacy/Dockerfile.dev`
- **Volumes**: Hot reload via volume mount
- **Environment**: Development mode with API URL

#### Backend
- **Port**: 3000
- **Build**: `backend/Dockerfile.dev`
- **Volumes**: Hot reload and Docker socket access
- **Environment**: Local execution mode

#### Code Runner Build
- **Purpose**: Builds the code runner image
- **No Running Instance**: Uses `replicas: 0`
- **Network**: Isolated `no-internet` network

### Networks

#### no-internet
- **Type**: Bridge network with no external access
- **Purpose**: Isolated execution environment for user code
- **Security**: Prevents code from accessing the internet

## Environment Variables

### Local Development Variables

```bash
# Execution Configuration
EXEC_MODE=local                   # Use local Docker runner
PORT=3000                         # Backend port
USER_CODE_FILE_PREFIX=main        # Default filename for user code
TRACESTORE_NAME=local-traces      # Local storage identifier

# Development Mode
NODE_ENV=development              # Enable development features
```

### AWS Variables (for deployment testing)

```bash
# AWS Configuration
AWS_REGION=us-west-2                        # AWS region
AWS_ACCOUNT_ID=123456789012                 # Your AWS account ID

# Lambda Configuration (from AWS deployment)
LAMBDA_FUNCTION_NAME=spp-trace-executor-prod # or -test for test environment
```

## Development Best Practices

### Code Style

#### Frontend (JavaScript/JSX)
- Use ESLint configuration in `.eslintrc.json`
- Follow React best practices
- Use PropTypes for component validation
- Prefer functional components for new code

#### Backend (TypeScript)
- Enable strict TypeScript checking
- Use proper typing for all functions
- Follow Express.js conventions
- Use async/await for promises

### Testing Strategy

#### Manual Testing
1. **Frontend**: Test in browser with developer tools
2. **Backend**: Use API testing tools (Postman, curl)
3. **Integration**: Test full workflow through UI

#### Code Execution Testing
1. **Simple Programs**: Basic C++ programs
2. **Memory Operations**: Programs with dynamic memory
3. **Error Cases**: Compilation errors, runtime errors
4. **Edge Cases**: Large programs, infinite loops

### Debugging Techniques

#### Frontend Debugging
```bash
# Open browser developer tools
# Check console for React errors
# Use React Developer Tools extension
./localdev.sh logs frontend-legacy --tail
```

#### Backend Debugging
```bash
# View server logs
./localdev.sh logs backend --tail

# Execute shell in backend container
./localdev.sh exec backend

# Check API endpoints
curl http://localhost:3000/api
```

#### Code Runner Debugging
```bash
# Check local execution files
ls -la /tmp/spp-usercode/

# View Docker containers
docker ps -a

# Check code runner image
docker images | grep spp-code-runner
```

## Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check if ports are in use
lsof -i :3000  # Backend
lsof -i :8000  # Frontend

# Solution: Stop conflicting services or change ports
```

#### Docker Issues
```bash
# Docker daemon not running
# Solution: Start Docker Desktop

# Permission issues (Linux/WSL)
sudo docker ps
# Solution: Add user to docker group
sudo usermod -aG docker $USER
```

#### Build Failures
```bash
# Clean rebuild
./localdev.sh clean
./localdev.sh rebuild

# Check Docker disk space
docker system df
docker system prune  # Clean up if needed
```

#### Code Execution Failures
```bash
# Check code runner image
docker images spp-code-runner:dev

# Rebuild code runner
./localdev.sh build code-runner-build

# Check execution logs
./localdev.sh logs backend --tail
```

### Performance Issues

#### Slow Startup
- **Cause**: Docker image builds
- **Solution**: Use `./localdev.sh up` instead of rebuild

#### Memory Usage
- **Monitoring**: Use Docker Desktop resource monitor
- **Optimization**: Adjust Docker Desktop memory limits

### Network Issues

#### API Connection Failed
```bash
# Check backend is running
curl http://localhost:3000/api

# Check Docker network
docker network ls
```

#### Frontend Can't Reach Backend
- Verify API URL in frontend configuration
- Check CORS settings in backend
- Ensure both services are running

## Development Workflow Examples

### Making a Frontend Change

1. Edit React component in `frontend-legacy/src/`
2. Save file (auto-reload triggers)
3. Test in browser at `http://localhost:8000`
4. Check browser console for errors
5. View logs if needed: `./localdev.sh logs frontend-legacy`

### Making a Backend Change

1. Edit TypeScript file in `backend/src/`
2. Save file (nodemon restarts server)
3. Test API endpoint with curl or frontend
4. Check logs: `./localdev.sh logs backend --tail`
5. Debug with `console.log()` if needed

### Adding a New Feature

1. **Plan**: Determine frontend/backend changes needed
2. **Backend First**: Implement API changes
3. **Test API**: Use curl or Postman
4. **Frontend**: Implement UI changes
5. **Integration Test**: Test full workflow
6. **Code Review**: Review changes before commit

## Next Steps

For production deployment:
- [Deployment Guide](./deployment.md) - AWS deployment procedures
- [Infrastructure Guide](./infrastructure.md) - AWS infrastructure details
- [Architecture Guide](./architecture.md) - System design overview 