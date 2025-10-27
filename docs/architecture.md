# See++ Architecture

This document provides a comprehensive overview of the See++ system architecture, explaining how the various components work together to provide C++ code visualization.

## System Overview

See++ is a distributed web application that compiles and executes C++ code in isolated environments, traces the execution using a modified Valgrind, and provides an interactive visualization of the program's memory state and execution flow.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Code Runner    │
│  (React/JSX)    │◄──►│  (Node.js/TS)   │◄──►│   (Lambda)      │
│                 │    │                 │    │                 │
│ - Code Editor   │    │ - API Server    │    │ - Compilation   │
│ - Visualization │    │ - Orchestration │    │ - Execution     │
│ - UI Controls   │    │ - Runner Invoke │    │ - Trace Gen     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   S3 Storage    │    │  AWS Lambda     │
                       │    (Optional)   │    │                 │
                       │ - Trace Cache   │    │ - Serverless    │
                       │                 │    │ - Isolation     │
                       │                 │    │ - Security      │
                       └─────────────────┘    └─────────────────┘
```

## Core Components

### 1. Frontend (React Application)

**Locations**: 
- `frontend-legacy/` (currently functional - main production)
- `frontend/` (under development - available at beta subdomain)

**Technology Stack**:
- **Legacy**: React 16.x, CodeMirror, Konva.js, JavaScript/JSX
- **New**: React 19.x, Monaco Editor, TypeScript

**Key Responsibilities**:
- Provide code editor interface with C++ syntax highlighting
- Send code execution requests to backend
- Visualize execution traces with interactive controls
- Display stack frames, heap memory, and variable values
- Support step-by-step execution navigation

**Deployment Strategy**:
- **Legacy Frontend**: Deployed to main domain (`[your-domain.com]`)
- **New Frontend**: Deployed to beta subdomain (`beta.[your-domain.com]`) for testing and gradual migration

**Note**: Domain configuration depends on your specific setup and Copilot service manifest configurations.

**Main Components** (Legacy):
- `App.jsx`: Main application container with state management
- `Ide.jsx`: Code editor with CodeMirror integration
- `Visualization.jsx`: Memory and execution visualization
- `VisualizationTool.js`: Core visualization logic
- `Api.js`: Backend communication layer

**Main Components** (New):
- TypeScript-based React components
- Monaco Editor integration for code editing
- Modern React patterns and hooks

### 2. Backend (Node.js/TypeScript API)

**Location**: `backend/`

**Technology Stack**:
- Node.js with Express framework
- TypeScript for type safety
- AWS SDK for ECS and S3 operations
- CORS enabled for cross-origin requests

**Key Responsibilities**:
- Receive and preprocess C++ code
- Orchestrate code execution in isolated environments
- Manage file storage and retrieval via S3
- Parse Valgrind traces into visualization data
- Provide RESTful API endpoints

**Core Architecture**:
```
backend/src/
├── index.ts              # Main Express server and API routes
├── runners/
│   ├── runner.interface.ts   # Common runner interface
│   ├── local.ts             # Local Docker runner (development)
│   ├── lambda.ts            # AWS Lambda runner (production)
│   └── index.ts             # Runner factory
├── valgrind_utils.ts        # Trace parsing and processing
└── parse_vg_trace.ts        # Valgrind output parser
```

**API Endpoints**:
- `GET /api`: Health check endpoint
- `POST /api/run`: Execute C++ code and return trace data

### 3. Code Runner (Isolated Execution Environment)

**Location**: `code-runner/`

**Technology Stack**:
- Modified Valgrind (SPP-Valgrind) for execution tracing
- g++ compiler for C++ compilation
- Docker containers for isolation
- Shell scripts for orchestration

**Key Responsibilities**:
- Compile C++ code using g++
- Execute programs under modified Valgrind
- Generate detailed execution traces
- Capture stdout, stderr, and compilation output
- Upload results to S3 storage

**Execution Flow**:
1. Download user code from S3
2. Compile code using g++
3. If compilation succeeds, run under Valgrind
4. Generate JSON trace file
5. Upload all outputs to S3

### 4. Modified Valgrind (SPP-Valgrind)

**Location**: `code-runner/SPP-Valgrind/` (git submodule)

**Purpose**: 
- Traces C++ program execution at the instruction level
- Captures memory allocations, deallocations, and access patterns
- Records function calls, returns, and stack frame changes
- Generates JSON output compatible with the visualization frontend

## Data Flow

### Code Execution Workflow

1. **User Input**: User writes C++ code in the frontend editor
2. **Submission**: Frontend sends POST request to `/api/run` with code
3. **Preprocessing**: Backend preprocesses code (adds necessary headers)
4. **Unique ID**: Backend generates UUID for the execution session
5. **Runner Selection**: Backend selects appropriate runner (Local vs Lambda)

**AWS Lambda Execution Path**:
6. **Lambda Invoke**: Backend invokes Lambda function with code as payload
7. **Compilation**: Lambda compiles code using g++ in `/tmp` directory
8. **Execution**: If compilation succeeds, Lambda executes under modified Valgrind
9. **Trace Generation**: Valgrind generates execution trace with memory/variable information
10. **Direct Response**: Lambda returns complete execution results:
    - `traceContent`: Raw Valgrind execution trace
    - `ccStdout` / `ccStderr`: Compilation output
    - `stdout` / `stderr`: Program execution output
11. **Response Processing**: Backend processes trace data into visualization format
12. **Frontend Response**: Processed trace data is returned to frontend
13. **Visualization**: Frontend renders interactive visualization

**Local Development Path** (steps 6-10 replaced):
6. **File System**: Backend writes code to local filesystem (`/tmp/spp-usercode/[uuid]/input/`)
7. **Container Launch**: Backend launches local Docker container with volume mounts
8. **Direct Execution**: Code runner compiles and executes with results written to mounted volumes
9. **File Reading**: Backend reads results directly from local filesystem (`/tmp/spp-usercode/[uuid]/output/`)

### Memory Management

**Stack Visualization**:
- Function call stack with frames
- Local variables with values and types
- Parameter passing visualization
- Return value tracking

**Heap Visualization**:
- Dynamic memory allocations (new/malloc)
- Memory deallocations (delete/free)
- Orphaned memory detection (leaks)
- Pointer/reference relationships

## Deployment Architectures

### Local Development

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Code Runner    │
│   (Legacy)      │    │                 │    │                 │
│ localhost:8000  │◄──►│ localhost:3000  │◄──►│   (on-demand)   │
│   (New)         │    │                 │    │                 │
│ localhost:8080  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  │
                        ┌─────────────────┐
                        │ Docker Network  │
                        │  (no-internet)  │
                        └─────────────────┘
```

### Production (AWS)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CloudFront    │    │  Load Balancer  │    │  AWS Lambda     │
│   (Frontend)    │    │   (Backend)     │    │ (Code Runner)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          │                       │                       │
          │                       │        ┌──────────────────┐
          │                       │        │  Lambda Process  │
          │                       │        │                  │
          │                       ├───────►│ 1. Receive code  │
          │                       │        │ 2. Compile (g++) │
          │                       │        │ 3. Run Valgrind  │
          │                       │◄───────│ 4. Return trace  │
          │                       │        └──────────────────┘
          │                       │
          │              ┌────────┴────────┐
          │              │                 │
          │              ▼                 ▼
          │    ┌─────────────────┐    ┌─────────────────┐
          │    │  Backend ECS    │    │   S3 Storage    │
          │    │    Service      │    │   (Optional)    │
          │    │                 │    │                 │
          └────┼─────────────────┼────┤ • Trace cache   │
               │                 │    │                 │
               └─────────────────┘    └─────────────────┘
                        │
              ┌─────────────────┐
              │      IAM        │
              │ (Roles/Policies)│
              └─────────────────┘
```

**Data Flow Details**:
1. **Backend → Lambda**: Invokes Lambda function with code as synchronous payload
2. **Lambda**: Compiles code with g++, runs under modified Valgrind in `/tmp`
3. **Lambda → Backend**: Returns complete execution results (trace, stdout, stderr, compilation outputs)
4. **Backend**: Processes trace data and returns to frontend
5. **Optional S3**: Lambda can cache results to S3 for frequently-run code (not currently enabled)

## Security Model

### Isolation Strategies

1. **Network Isolation**: Code runner containers have no internet access
2. **Resource Limits**: CPU, memory, and execution time constraints
3. **Filesystem Isolation**: Containers run with limited filesystem access
4. **IAM Restrictions**: Minimal required permissions for AWS resources

### AWS Security

- **S3 Encryption**: All stored files use server-side encryption
- **VPC Isolation**: ECS tasks run in private subnets
- **IAM Least Privilege**: Roles have minimal required permissions
- **Security Groups**: Restrictive network access rules

## Performance Considerations

### Performance Characteristics

1. **Lambda Cold Start**: ~1-3 seconds for first invocation
2. **Lambda Warm Execution**: <1 second for subsequent invocations
3. **Compilation Time**: ~0.5-2 seconds depending on code complexity
4. **Valgrind Execution**: Varies by program (typically <30 seconds)

### Optimization Strategies

1. **Lambda Provisioned Concurrency**: Keep functions warm for consistent performance
2. **Caching**: S3-based caching for frequently-executed code (optional)
3. **Parallel Processing**: Lambda handles concurrent executions automatically
4. **Regional Deployment**: Multi-region for reduced latency

## Technology Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend (Legacy) | React 16.x, CodeMirror, Konva.js | User interface and visualization |
| Frontend (New) | React 19.x, Monaco Editor, TypeScript | Modern user interface |
| Backend | Node.js, TypeScript, Express | API server and orchestration |
| Code Runner (Production) | AWS Lambda, Python, Modified Valgrind, g++ | Serverless code execution |
| Code Runner (Development) | Docker, Bash, Modified Valgrind, g++ | Local code execution |
| Storage (Optional) | AWS S3 | Trace caching |
| Compute | AWS Lambda | Serverless execution |
| Infrastructure | AWS Copilot | Infrastructure as code |
| Development | Docker Compose | Local development environment |

## Next Steps

For detailed information on specific aspects:
- [Local Development Guide](./development.md)
- [Infrastructure Guide](./infrastructure.md)
- [Deployment Guide](./deployment.md) 