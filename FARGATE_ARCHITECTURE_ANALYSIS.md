# See++ Fargate to Lambda Migration: Architecture Analysis Report

## Executive Summary

This document provides a comprehensive analysis of the current See++ backend implementation using AWS Fargate for C++ code execution and tracing with Valgrind. This analysis serves as the foundation for porting the system to AWS Lambda with the modernized Valgrind 3.27.0.

---

## 1. MAIN ENTRY POINT FOR FARGATE EXECUTION

### Backend API Server (`backend/src/index.ts`)

**Port**: 3000 (configurable via `PORT` env var)

**Key Endpoint**: `POST /api/run`
- Accepts: `{ code: string }` 
- Returns: Trace data compatible with frontend visualization

**Key Environment Variables**:
- `EXEC_MODE`: Either "local" or "fargate" (determines which runner to use)
- `NODE_ENV`: "development" or production
- `ALLOWED_ORIGIN_REGEX`: CORS origin pattern
- `USER_CODE_FILE_PREFIX`: Filename prefix for user code (default: "main")

**Request Flow**:
1. User sends POST to `/api/run` with C++ code
2. Backend preprocesses code: `#define union struct\n${userCode}`
3. Generates unique ID (SHA-256 hash of preprocessed code in production, random UUID in development)
4. Creates runner instance based on `EXEC_MODE`
5. Awaits execution result
6. Parses Valgrind trace into visualization format
7. Returns structured trace response to frontend

---

## 2. C++ CODE COMPILATION AND TRACE GENERATION WITH VALGRIND

### Architecture Overview

The system uses a **two-stage execution model**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Fargate Task (ECS)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Container: spp-code-runner (Ubuntu 14.04 based)    │  │
│  │                                                      │  │
│  │ 1. Download code from S3                           │  │
│  │ 2. Compile with g++ -std=c++11 -ggdb -O0           │  │
│  │ 3. Run under Valgrind (memcheck tool)              │  │
│  │ 4. Generate JSON trace with variable info          │  │
│  │ 5. Upload results to S3                            │  │
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                         │                                   │
│                         ▼                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Included Software                                    │  │
│  │ • g++-4.8 (compiler)                               │  │
│  │ • Modified Valgrind 3.x (memcheck + tracing)       │  │
│  │ • AWS CLI v2 (S3 operations)                       │  │
│  │ • libc6-dbg (debugging symbols)                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Compilation Flags

```bash
g++-4.8 -std=c++11 -ggdb -O0 -fno-omit-frame-pointer \
  -o main.out main.cpp
```

**Explanation**:
- `-std=c++11`: C++11 standard support
- `-ggdb`: Debug symbols for GDB compatibility
- `-O0`: No optimization (preserves original code structure)
- `-fno-omit-frame-pointer`: Maintains frame pointers for Valgrind's stack unwinding
- `-ggdb`: Enables source-level debugging info for Valgrind

### Valgrind Execution

**Modified Valgrind**: SPP-Valgrind (specialized fork)
- Tool: `memcheck` 
- Output: Custom JSON trace format with variable information

**Valgrind Invocation**:
```bash
/spp-valgrind/inst/bin/valgrind \
  --tool=memcheck \
  --source-filename="main.cpp" \
  --trace-filename="main_vgtrace.txt" \
  main.out > main_out.txt 2> main_err.txt
```

**Valgrind Custom Flags** (from SPP-Valgrind):
- `--source-filename`: Path to source C++ file (for variable mapping)
- `--trace-filename`: Output file for detailed execution trace

**Trace Output Format**: JSON with structure:
```json
{
  "line": 42,
  "stack": [
    {
      "func_name": "main",
      "FP": "0x7ffc1234",
      "line": 42,
      "locals": {
        "x": {"kind": "base", "type": "int", "val": "10", "addr": "0x..."},
        "ptr": {"kind": "pointer", "val": "0x...", "deref_val": {...}}
      }
    }
  ],
  "globals": {...},
  "ordered_globals": ["g1", "g2"]
}
```

---

## 3. DOCKER CONFIGURATION FOR FARGATE

### Current Production Dockerfile (`code-runner/Dockerfile.prod`)

**Multi-stage build approach**:

```dockerfile
# Stage 1: Builder - Compiles Valgrind
FROM ubuntu:14.04 AS builder
RUN apt-get update && apt-get install -y gcc-4.8 g++-4.8 make autoconf automake libtool
COPY SPP-Valgrind /spp-valgrind
WORKDIR /spp-valgrind
RUN ./autogen.sh && ./configure --prefix=/spp-valgrind/inst && make -j$(nproc) && make install

# Stage 2: Runtime - Minimal image with compiled Valgrind
FROM ubuntu:14.04
RUN apt-get update && apt-get install -y gcc-4.8 g++-4.8 libc6-dbg curl ca-certificates
# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip awscliv2.zip && ./aws/install
COPY --from=builder /spp-valgrind/inst/ /spp-valgrind/inst/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
```

**Image Size**: ~800MB-1GB
**Base OS**: Ubuntu 14.04 (legacy but stable for backward compatibility)
**Entrypoint**: `entrypoint.sh` shell script

### New Code Runner Dockerfile (`code-runner-new/Dockerfile`)

Uses Amazon Linux 2023 (modern baseline):
```dockerfile
FROM public.ecr.aws/amazonlinux/amazonlinux:2023
RUN yum install -y gcc gcc-c++ make automake autoconf libtool glibc-devel python3
WORKDIR /workspace
ENV PATH="/workspace/valgrind/inst/bin:${PATH}"
```

---

## 4. API ENDPOINTS AND REQUEST/RESPONSE FORMAT

### HTTP Endpoints

**Health Check**
```
GET /api
Response: "See++ backend online"
```

**Code Execution** 
```
POST /api/run
Content-Type: application/json

Request Body:
{
  "code": "#include <iostream>\nint main() {\n  std::cout << \"Hello\" << std::endl;\n  return 0;\n}"
}

Response (Success):
{
  "code": "...",
  "trace": [
    {
      "event": "stepLine",
      "line": 2,
      "funcName": "main",
      "stackToRender": [
        {
          "funcName": "main",
          "orderedVarNames": ["x", "y"],
          "frameId": "0x7ffc...",
          "encodedLocals": {
            "x": ["C_DATA", "0x...", "int", "10"],
            "y": ["C_DATA", "0x...", "int", "20"]
          }
        }
      ],
      "globals": {...},
      "orderedGlobals": ["g1"],
      "stdout": "Hello\n"
    }
    // ... more execution points
  ]
}

Response (Compilation Error):
{
  "code": "...",
  "trace": [
    {
      "event": "uncaughtException",
      "exceptionMsg": "error: 'std' has not been declared",
      "line": 3
    }
  ]
}
```

### Runner Interface

Both local and Fargate runners implement:
```typescript
interface TraceRunner {
  run(code: string, uniqueId: string): Promise<RunnerResult>;
}

interface RunnerResult {
  ccStdout: string;      // g++ compilation stdout
  ccStderr: string;      // g++ compilation stderr
  stdout: string;        // Program execution stdout
  stderr: string;        // Program execution stderr
  traceContent: string;  // Valgrind JSON trace (or "" if compilation failed)
}
```

---

## 5. HOW TRACES ARE GENERATED AND RETURNED

### Trace Generation Pipeline

```
Valgrind Output (raw)
     ▼
parseValgrindTrace() [parse_vg_trace.ts]
     │
     ├─ Split by "=== pg_trace_inst ===" records
     ├─ Parse JSON from each record
     ├─ Extract ERROR and STDOUT lines
     ├─ Build ExecutionPoint array
     │
     ▼
finalizeTrace() - Post-processing
     │
     ├─ Filter invalid records (0x0 FP, ???)
     ├─ Detect call/return events
     ├─ Remove duplicate steps on same line
     ├─ Skip non-main functions
     ├─ Truncate to MAX_STEPS (1000)
     │
     ▼
ExecutionPoint[] with structure:
{
  event: "stepLine" | "call" | "return" | "exception",
  line: number,
  funcName: string,
  stackToRender: StackFrame[],
  globals: Record<string, any>,
  heap: Record<string, any>,
  stdout: string,
  exceptionMsg?: string
}
```

### Encoding Format

Variables are encoded into OPT C format:
```typescript
// Primitive type
["C_DATA", address, type, value]
// Example: ["C_DATA", "0x1234", "int", "42"]

// Struct
["C_STRUCT", address, type_name, ["field1", value1], ["field2", value2]]

// Array
["C_ARRAY", address, elem1, elem2, elem3]

// Multi-dimensional array
["C_MULTIDIMENSIONAL_ARRAY", address, [rows, cols], elem1, elem2, ...]
```

### Caching Strategy

**In Deployed Environments** (production):
- Use SHA-256 hash of preprocessed code as unique ID
- Check S3 for existing results before executing
- Cache hit returns stored results immediately
- Cache miss proceeds with normal execution
- Results stored for future requests

**In Development**:
- Use random UUID for each execution
- No caching to avoid collisions during testing

---

## 6. ENVIRONMENT-SPECIFIC CONFIGURATIONS

### Local Development Mode

**Settings** (`backend/src/runners/local.ts`):
```typescript
EXEC_MODE = "local"
NODE_ENV = "development"
Docker Network = "spp_no-internet" (isolated, no internet access)
Shared Directory = "/tmp/spp-usercode"
Container Image = "spp-code-runner:dev"
```

**File Flow**:
1. Backend writes code to `/tmp/spp-usercode/[uuid]_code.cpp`
2. Launches Docker container with volume mounts
3. Container compiles and runs code
4. Results written to mounted volumes
5. Backend reads results directly from filesystem

**Execution Command**:
```bash
docker run --rm \
  --network spp_no-internet \
  -v /tmp/spp-usercode/uuid.cpp:/main.cpp \
  -v /tmp/spp-usercode/uuid_vgtrace.txt:/main_vgtrace.txt \
  # ... other volume mounts for output files ...
  spp-code-runner:dev
```

### AWS Fargate Production Mode

**Settings** (`backend/src/runners/fargate.ts`):
```typescript
EXEC_MODE = "fargate"
NODE_ENV = "production"
Platform = "FARGATE"
CPU = "1024" (1 vCPU)
Memory = "2048" MB
Network = "awsvpc" (VPC networking)
Subnets = Private subnets (from env vars)
SecurityGroup = Restricted security group
Image = ECR repository URL
```

**S3-Based File Transfer**:
```
Backend → S3: [uuid]/[uuid]_code.cpp
Task ← S3: Downloads using AWS CLI
Task → S3: [uuid]/[uuid]_trace.json, etc.
Backend ← S3: Downloads results
```

**Task Environment Variables** (set via RunTaskCommand):
```
ID                = unique-execution-id
BUCKET            = S3 bucket name
CODE_KEY          = s3 key for input code
TRACE_KEY         = s3 key for output trace
CC_STDOUT_KEY     = s3 key for compilation stdout
CC_STDERR_KEY     = s3 key for compilation stderr
STDOUT_KEY        = s3 key for program stdout
STDERR_KEY        = s3 key for program stderr
```

### Environment Variable Sources

**Backend Container** (from AWS Systems Manager Parameter Store):
```
/copilot/spp/{environment}/secrets/CLUSTER_ARN
/copilot/spp/{environment}/secrets/TASK_DEF_ARN
/copilot/spp/{environment}/secrets/SUBNETS
/copilot/spp/{environment}/secrets/SECURITY_GROUP
```

**Task Definition**:
- Execution Role: Pulls images from ECR, writes logs
- Task Role: Calls ECS, S3 operations

**ECS Cluster**:
- Region: us-west-2 (configurable)
- VPC: Created by Copilot
- Private subnets for tasks (no internet access)
- Security groups restrict inbound/outbound

---

## 7. CURRENT PERFORMANCE BOTTLENECKS WITH FARGATE

### Identified Bottlenecks

#### 1. **Container Initialization** (30-60 seconds)
- Fargate task spin-up time
- Image pull from ECR
- Environment setup

**Impact**: ~2x longer than Lambda cold start

#### 2. **S3 File Transfer Overhead** (5-15 seconds per execution)
- Upload code to S3
- Fargate task downloads from S3
- Task uploads results to S3
- Backend downloads results from S3

**Total I/O**: 4 S3 operations minimum

**Impact**: Significant for small programs with quick execution

#### 3. **Compilation Step** (2-10 seconds)
- g++ compiler startup
- Parsing and compilation

**Can be optimized**: Pre-compiled binaries cache (not currently implemented)

#### 4. **Valgrind Overhead** (variable, 1-30+ seconds)
- Execution tracing adds 5-100x slowdown
- More complex programs take longer
- Memory-intensive programs get slower Valgrind performance

#### 5. **Network Latency** (unpredictable)
- Fargate task in private subnet
- NAT gateway for S3 access
- Regional latency

#### 6. **Resource Constraints**
- 1 vCPU allocated (shared)
- 2GB memory (reasonable but not excessive)
- Single-threaded execution model

#### 7. **ALB Timeout Considerations**
- Current config: 300 second timeout (5 minutes)
- Large traces or slow compilations can hit limit
- No built-in retry logic

### Performance Metrics from Architecture

**Request Timeline** (typical small program):
```
0ms     - Backend receives request
50ms    - Code preprocessing, ID generation
100ms   - Code uploaded to S3
150ms   - Fargate task launched
2000ms  - Task started (container initialized)
2500ms  - Code downloaded from S3
2600ms  - Compilation started
3000ms  - Compilation complete
3100ms  - Valgrind execution started
3500ms  - Valgrind complete, results uploaded
3600ms  - Backend downloads results
3700ms  - Trace parsed and formatted
3750ms  - Response sent to frontend

Total: ~3.75 seconds for "Hello World" program
```

---

## 8. DEPLOYMENT INFRASTRUCTURE

### AWS Resources

**ECS Cluster**: `spp-{env}-Cluster`
- Managed by Copilot
- Fargate tasks (no EC2 instances)

**Task Definition**: `spp-code-runner-task-{env}`
- Version tracked by Copilot
- CPU: 1024, Memory: 2048
- Logging to CloudWatch

**ECR Repository**: `spp-code-runner`
- Images tagged by environment (test, prod)
- Multi-stage build reduces image size

**S3 Bucket**: `spp-{env}-addons-...-tracestorebucket-...`
- Versioning enabled
- Encryption: AES256
- Lifecycle policy: Non-current versions deleted after 30 days
- Public access blocked

**IAM Roles**:
- Backend Execution Role: Pull images, write logs
- Backend Task Role: RunTask, DescribeTasks, S3 access
- Code Runner Task Role: S3 access only

**Load Balancer**: 
- Idle timeout: 300 seconds
- Health check on `/api`
- Internal ALB for backend

---

## 9. KEY FILES AND THEIR LOCATIONS

| Component | File Path | Purpose |
|-----------|-----------|---------|
| Backend Entry | `backend/src/index.ts` | Express server, API routes |
| Fargate Runner | `backend/src/runners/fargate.ts` | ECS task orchestration |
| Local Runner | `backend/src/runners/local.ts` | Docker-based execution |
| Trace Parser | `backend/src/parse_vg_trace.ts` | Valgrind JSON parsing |
| Valgrind Utils | `backend/src/valgrind_utils.ts` | Trace formatting, preprocessing |
| Code Runner Dockerfile | `code-runner/Dockerfile.prod` | Production image build |
| Entrypoint Script | `code-runner/entrypoint.sh` | Container entry point |
| SPP-Valgrind | `code-runner/SPP-Valgrind/` | Modified Valgrind source (submodule) |
| Deployment Script | `copilot/deploy-environment.sh` | Full environment deployment |
| Backend Manifest | `copilot/backend/manifest.yml` | Service configuration |
| Trace Store Config | `copilot/backend/addons/trace-store.yml` | S3 bucket CloudFormation |
| Local Dev Script | `localdev.sh` | Local development commands |
| Docker Compose | `docker-compose.yml` | Local development environment |
| New Valgrind | `code-runner-new/` | Modernized Valgrind 3.27.0 |

---

## 10. MIGRATION CONSIDERATIONS FOR LAMBDA

### Advantages for Lambda Migration

1. **Faster Cold Starts**: Lambda provides ~3-5 second initialization vs Fargate's 30-60 seconds
2. **Pay-per-Use**: No idle container costs
3. **Automatic Scaling**: Lambda handles concurrent requests natively
4. **Simpler Deployment**: Single artifact, no ECS task definitions
5. **Integrated Logging**: CloudWatch integration built-in

### Challenges for Lambda Migration

1. **Execution Time Limits**: Lambda timeout is 15 minutes max (current config is already at limit)
2. **Memory Constraints**: Lambda max 10GB vs Fargate's 30GB+
3. **Temporary Storage**: `/tmp` is 512MB max on Lambda vs unlimited on Fargate
4. **Package Size**: Lambda deployment package (with Valgrind) may exceed 250MB limit
5. **Stateless Execution**: No persistent scratch space between invocations
6. **Cold Start Warmup**: Container-based Lambda might not be much faster than Fargate for first request

### Critical Path to Port

1. **Valgrind Integration**:
   - Package Valgrind 3.27.0 in Lambda layer (or embedded in function)
   - Current SPP-Valgrind works; new version in code-runner-new

2. **S3 Strategy**:
   - Keep S3 for code/results (same as current)
   - Lambda has IAM permissions for S3 access

3. **Entrypoint Logic**:
   - Adapt `entrypoint.sh` logic to Lambda handler
   - Environment variables same as Fargate
   - Handler: Compile → Run Valgrind → Upload results

4. **File Transfer**:
   - Keep S3 as intermediate storage
   - Or use Lambda's direct code parameter (limited to 6MB payload)

---

## CONCLUSION

The See++ system uses a well-architected Fargate-based runner that successfully isolates user code execution and generates detailed execution traces. The system is fundamentally sound but has optimization opportunities, particularly around initialization time and S3 overhead.

The Valgrind 3.27.0 upgrade in `code-runner-new/` provides a path to modernization while maintaining trace compatibility. The Lambda migration should focus on reducing cold-start overhead while maintaining the same trace generation pipeline and security model.

