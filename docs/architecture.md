# See++ Architecture

This document provides a comprehensive overview of the See++ system architecture, explaining how the various components work together to provide C++ code visualization.

## System Overview

See++ is a distributed web application that compiles and executes C++ code in isolated environments, traces the execution using a modified Valgrind, and provides an interactive visualization of the program's memory state and execution flow.

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │  Code Runner    │
│  (React/JSX)    │◄──►│  (Node.js/TS)   │◄──►│   (Valgrind)    │
│                 │    │                 │    │                 │
│ - Code Editor   │    │ - API Server    │    │ - Compilation   │
│ - Visualization │    │ - Orchestration │    │ - Execution     │
│ - UI Controls   │    │ - S3 Storage    │    │ - Trace Gen     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                │                       │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   S3 Storage    │    │  ECS Fargate    │
                       │                 │    │                 │
                       │ - User Code     │    │ - Task Execution│
                       │ - Trace Files   │    │ - Isolation     │
                       │ - Output Files  │    │ - Security      │
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
│   ├── fargate.ts           # AWS Fargate runner (production)
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

**Location**: `code-runner/SPP-Valgrind/` (Git submodule)

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
5. **Runner Selection**: Backend selects appropriate runner (Local vs Fargate)

**AWS Fargate Execution Path**:
6. **S3 Upload**: Backend uploads preprocessed code to S3 as `[uuid]/[uuid]_code.cpp`
7. **Task Launch**: Backend launches ECS Fargate task with environment variables:
   - `BUCKET`: S3 bucket name
   - `CODE_KEY`: Path to user code file
   - `TRACE_KEY`, `CC_STDOUT_KEY`, etc.: Paths for result files
8. **Code Download**: Code runner downloads user code from S3 using AWS CLI
9. **Compilation**: Code runner compiles code using g++ and uploads compilation outputs to S3
10. **Execution**: If compilation succeeds, code runner executes under modified Valgrind
11. **Result Upload**: Code runner uploads all outputs to S3:
    - `[uuid]_trace.json`: Valgrind execution trace
    - `[uuid]_cc_stdout.txt` / `[uuid]_cc_stderr.txt`: Compilation output
    - `[uuid]_stdout.txt` / `[uuid]_stderr.txt`: Program execution output
12. **Task Monitoring**: Backend waits for ECS task completion
13. **Result Download**: Backend downloads all result files from S3 in parallel
14. **Response Processing**: Backend processes trace data into visualization format
15. **Frontend Response**: Processed trace data is returned to frontend
16. **Visualization**: Frontend renders interactive visualization

**Local Development Path** (steps 6-13 replaced):
6. **File System**: Backend writes code to local filesystem (`/tmp/spp-usercode/[uuid]/`)
7. **Container Launch**: Backend launches local Docker container with volume mounts
8. **Direct Execution**: Code runner compiles and executes with results written to mounted volumes
9. **File Reading**: Backend reads results directly from local filesystem

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
│   CloudFront    │    │  Load Balancer  │    │   ECS Fargate   │
│   (Frontend)    │    │   (Backend)     │    │ (Code Runner)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
          │                       │                       │
          │                       │                       │
          │              ┌────────┴────────┐              │
          │              │                 │              │
          │              ▼                 ▼              │
          │    ┌─────────────────┐    ┌─────────────────┐ │
          │    │   User Code     │    │  Trace Results  │ │
          │    │   (Upload)      │    │   (Download)    │ │
          │    │                 │    │                 │ │
          └────┼─────────────────┼────┼─────────────────┼─┘
               │                 │    │                 │
               ▼                 │    │                 ▼
      ┌─────────────────────────────┐ │ ┌──────────────────┐
      │       S3 Storage            │ │ │  Code Runner     │
      │                             │ │ │    Process       │
      │ Files per execution:        │ │ │                  │
      │ • [id]_code.cpp             │ │ │ 1. Download code │
      │ • [id]_trace.json           │◄┘ │ 2. Compile       │
      │ • [id]_cc_stdout.txt        │   │ 3. Run Valgrind  │
      │ • [id]_cc_stderr.txt        │◄──│ 4. Upload results│
      │ • [id]_stdout.txt           │   └──────────────────┘
      │ • [id]_stderr.txt           │
      └─────────────────────────────┘
                  │
        ┌─────────────────┐
        │      IAM        │
        │ (Roles/Policies)│
        └─────────────────┘
```

**Data Flow Details**:
1. **Backend → S3**: Uploads user code to `[unique-id]/[id]_code.cpp`
2. **Backend → ECS**: Launches Fargate task with S3 keys as environment variables
3. **Code Runner → S3**: Downloads user code using AWS CLI
4. **Code Runner**: Compiles code with g++, runs under modified Valgrind
5. **Code Runner → S3**: Uploads all results (trace, stdout, stderr, compilation outputs)
6. **Backend ← S3**: Downloads and processes results for frontend response

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

### Current Bottlenecks

1. **Container Startup**: ECS Fargate task initialization (~30-60s)
2. **Network Overhead**: S3 upload/download for file transfer
3. **Resource Allocation**: Single-threaded execution model

### Optimization Strategies

1. **Warm Containers**: Pre-warmed container pools
2. **Caching**: Compiled binary caching for repeated executions
3. **Parallel Processing**: Multiple concurrent executions
4. **Regional Deployment**: Multi-region for reduced latency

## Technology Stack Summary

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend (Legacy) | React 16.x, CodeMirror, Konva.js | User interface and visualization |
| Frontend (New) | React 19.x, Monaco Editor, TypeScript | Modern user interface |
| Backend | Node.js, TypeScript, Express | API server and orchestration |
| Code Runner | Docker, Modified Valgrind, g++ | Isolated code execution |
| Storage | AWS S3 | File storage and transfer |
| Compute | AWS ECS Fargate | Scalable container execution |
| Infrastructure | AWS Copilot | Infrastructure as code |
| Development | Docker Compose | Local development environment |

## Next Steps

For detailed information on specific aspects:
- [Local Development Guide](./development.md)
- [Infrastructure Guide](./infrastructure.md)
- [Deployment Guide](./deployment.md) 