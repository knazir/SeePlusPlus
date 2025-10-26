# Valgrind Modernization Plan for See++

**Document Version:** 1.0
**Date:** October 25, 2025
**Author:** System Analysis
**Status:** Planning Phase

---

## Executive Summary

This document outlines a comprehensive plan to modernize See++'s Valgrind-based code execution tracing system from version 3.11.0 (released July 2015) to version 3.26.0 (released October 2025). This upgrade is critical for compatibility with Amazon Linux 2023's modern toolchain (GCC 11.5/14.2, glibc updates) and to enable deployment as AWS Lambda functions.

**Key Challenges:**
- 10+ year gap between Valgrind versions (3.11.0 → 3.26.0)
- Significant DWARF debuginfo API changes (DWARF2/3/4 → DWARF5 support)
- Custom code modifications totaling ~2,900 lines across 8 files
- Embedded JSON library and type introspection system
- I/O redirection mechanisms specific to Docker containers

**Estimated Effort:** Medium-High complexity, 2-3 week implementation timeline

**Success Criteria:**
- Feature parity with existing SPP-Valgrind functionality
- Compatibility with Amazon Linux 2023 toolchain
- Successful deployment in AWS Lambda environment
- Maintained or improved performance characteristics

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target Environment](#2-target-environment)
3. [Gap Analysis](#3-gap-analysis)
4. [Architecture Design](#4-architecture-design)
5. [Implementation Plan](#5-implementation-plan)
6. [Testing Strategy](#6-testing-strategy)
7. [Risk Assessment](#7-risk-assessment)
8. [Timeline and Milestones](#8-timeline-and-milestones)
9. [Appendices](#9-appendices)

---

## 1. Current State Analysis

### 1.1 SPP-Valgrind Overview

**Base Version:** Valgrind 3.11.0 (July 2015)
**Repository:** https://github.com/knazir/SPP-Valgrind
**Location:** `code-runner/SPP-Valgrind/`

**Modification Lineage:**
1. **Base:** Valgrind 3.11.0 (commit f8bed03)
2. **Layer 1:** Philip Guo (pgbovine) modifications for OnlinePythonTutor (commit ca3bf1a)
3. **Layer 2:** See++ custom modifications (commits faf830c, ef0439f, efcc06a, f6da881)

### 1.2 Modification Statistics

#### Commit ca3bf1a - OPT (pgbovine) Modifications
Total: **2,879 insertions** across 8 files

| File | Lines Added | Purpose |
|------|-------------|---------|
| `coregrind/m_debuginfo/debuginfo.c` | +1,669 | JSON library + type serialization |
| `coregrind/m_debuginfo/tytypes.c` | +615 | Type system extensions |
| `memcheck/mc_translate.c` | +339 | Instruction-level tracing hook |
| `include/pub_tool_debuginfo.h` | +142 | Public API exports |
| `memcheck/mc_main.c` | +53 | Option handling, I/O setup |
| `memcheck/mc_errors.c` | +48 | Error redirection |
| `memcheck/mc_include.h` | +17 | Internal exports |
| `coregrind/m_debuginfo/priv_tytypes.h` | +7 | Private headers |

#### Commits faf830c, ef0439f - SPP Custom Modifications
Total: **~30 insertions** (refinements)

| Modification | Purpose |
|--------------|---------|
| Union type handling in tytypes.c | Fix union serialization issues |
| /tmp file I/O for stdout | Docker permission workarounds |
| Parallel execution support | Multiple trace generation |

### 1.3 Core Functionality

#### Tracing Mechanism

```
User Code (main.cpp)
        ↓
    Compile with debug info (-ggdb -O0)
        ↓
    Run under modified Valgrind
        ↓
    Memcheck tool with pg_trace_inst hook
        ↓
    Capture at every Ist_IMark (instruction mark)
        ↓
    Serialize to JSON trace file
```

#### Data Captured Per Instruction

```json
{
  "func_name": "main",
  "line": 42,
  "IP": "0x4005c0",
  "kind": 0,
  "local_vars": [...],
  "global_vars": [...],
  "heap_vars": [...],
  "stack_frames": [...]
}
```

**Key Components:**
1. **Function metadata:** Name, line number, instruction pointer
2. **Variable states:** Local, global, heap-allocated variables with values
3. **Type information:** Full DWARF type introspection (primitives, pointers, arrays, structs)
4. **Memory state:** Stack frames, heap blocks, pointer relationships
5. **Program output:** Captured stdout as JSON string

### 1.4 Technical Implementation Details

#### 1.4.1 Instruction-Level Hook (mc_translate.c:6785-6793)

```c
case Ist_IMark:
    // pgbovine -- from fjalar
    di = unsafeIRDirty_0_N(1/*regparms*/,
         "pg_trace_inst",
         &pg_trace_inst,
         mkIRExprVec_1(IRExpr_Const(IRConst_U64(st->Ist.IMark.addr))));
    stmt('V', &mce, IRStmt_Dirty(di));
    break;
```

**Mechanism:**
- Hooks into Valgrind's VEX IR (Intermediate Representation)
- `Ist_IMark` = instruction mark in IR, represents one source instruction
- Creates "dirty call" (function call from instrumented code)
- Passes instruction address to `pg_trace_inst()` function

#### 1.4.2 Trace Generation Function (mc_translate.c:6271-6400)

**Key Steps:**
1. **File filtering:** Only trace instructions from specified source file
2. **Step limiting:** Maximum 5,000 steps to prevent infinite loops
3. **Stdout capture:** Read from `/tmp/stdout.txt` redirected file descriptor
4. **JSON encoding:** Use embedded JSON library to encode output
5. **Debug info queries:**
   - `VG_(get_filename)()` - Source file name
   - `VG_(get_fnname)()` - Function name
   - `VG_(get_linenum)()` - Line number
   - `VG_(get_StackTrace)()` - Stack trace with IPs, SPs, FPs
6. **Type introspection:** Call debuginfo functions to serialize variable states
7. **Deduplication:** Use OSet to avoid encoding same address multiple times per step

#### 1.4.3 JSON Library (debuginfo.c:~1669 lines)

**Embedded Components:**
- String buffer management (`SB` struct, `sb_init`, `sb_grow`, `sb_puts`)
- JSON node creation (`JsonNode` struct, tag-based union)
- JSON parsing (not heavily used)
- JSON stringification (`json_stringify`, `emit_string`, `emit_value`)
- String encoding (`json_encode_string` - critical for stdout capture)

**Why Embedded:**
- Valgrind tools cannot link to external libraries
- Must use Valgrind's own memory allocators (`VG_(malloc)`, `VG_(free)`)
- Operates in restricted environment (no libc)

#### 1.4.4 Type Introspection System (debuginfo.c + tytypes.c)

**DWARF Debug Info Processing:**
- Reads DWARF2/3/4 debug information from compiled binary
- Extracts type definitions (structs, unions, arrays, pointers)
- Serializes variable values from memory addresses
- Handles complex types recursively

**Key Functions:**
- Variable metadata extraction
- Structure/class field enumeration
- Array dimension and bounds analysis
- Pointer target resolution
- Global variable enumeration
- Stack frame variable collection

#### 1.4.5 Stdout Redirection Mechanism (mc_main.c)

```c
// Post-initialization hook
static void mc_post_clo_init(void) {
    // Create/clear stdout capture file
    stdout_fd = VG_(fd_open)("/tmp/stdout.txt",
                              VKI_O_WRONLY|VKI_O_CREAT|VKI_O_TRUNC,
                              0600);
    // Redirect file descriptor 1 (stdout) to this file
    VG_(dup2)(stdout_fd, 1);
}
```

**Per-instruction capture:**
```c
// In pg_trace_inst()
VG_(lseek)(stdout_fd, 0, VKI_SEEK_SET);  // Rewind to start
int nbytes = VG_(read)(stdout_fd, user_stdout_buf, 10*1024*1024);
char* json_buf = json_encode_string(user_stdout_buf);
VG_(fprintf)(trace_fp, "STDOUT: %s\n", json_buf);
```

**Requirements:**
- Program must run with `stdbuf -o0` (unbuffered stdout)
- Limited to 10MB stdout per trace
- File-based approach needed for Docker permission issues

### 1.5 Build and Execution

#### Build Configuration
```bash
./configure --prefix=/spp-valgrind/inst
make
make install
```

**Result:**
- Binary: `/spp-valgrind/inst/bin/valgrind`
- Libraries: `/spp-valgrind/inst/lib/valgrind/`

#### Execution (from entrypoint.sh)
```bash
# Compilation
g++-4.8 -std=c++11 -ggdb -O0 -fno-omit-frame-pointer \
    -o main.out main.cpp

# Execution
stdbuf -o0 /spp-valgrind/inst/bin/valgrind \
    --tool=memcheck \
    --source-filename="main.cpp" \
    --trace-filename="main_vgtrace.txt" \
    main.out
```

**Critical Flags:**
- `-ggdb`: Maximum debug info (DWARF)
- `-O0`: No optimization (preserves variables)
- `-fno-omit-frame-pointer`: Accurate stack traces
- `stdbuf -o0`: Unbuffered stdout

---

## 2. Target Environment

### 2.1 Amazon Linux 2023 Specifications

**Operating System:**
- **Distribution:** Amazon Linux 2023 (AL2023)
- **Kernel:** Linux 6.1+ (modern kernel)
- **Architecture:** x86_64 (amd64)
- **Support Period:** 5 years from release

**Core Toolchain:**

| Component | Default Version | Optional Version | Notes |
|-----------|----------------|------------------|-------|
| **GCC** | 11.5.0 | 14.2.1 (gcc14) | Major version stable for AL2023 lifetime |
| **glibc** | 2.34+ | - | Significant update from older versions |
| **binutils** | 2.38+ | - | Modern assembler/linker |
| **DWARF** | Version 5 | - | GCC 11+ default output format |

**Key Changes from Legacy Environment:**
- **GCC:** 4.8 → 11.5/14.2 (major version jump)
- **DWARF:** Version 3/4 → Version 5 (debug info format)
- **glibc:** 2.17 → 2.34+ (syscall changes, new features)
- **C++ Standard:** C++11 → C++17/20/23 support

### 2.2 AWS Lambda Constraints

**Runtime Specifications:**
- **Memory:** 128MB - 10,240MB (configurable)
- **Timeout:** 15 minutes maximum
- **Ephemeral Storage:** 512MB - 10,240MB (`/tmp`)
- **Deployment Package:** 50MB (zipped), 250MB (unzipped)

**Implications for Valgrind:**
1. **Binary Size:** Valgrind installation must fit in deployment package
2. **Cold Start:** Initialization time critical (affects first invocation)
3. **Memory Overhead:** Valgrind's instrumentation adds memory usage
4. **Execution Time:** 5,000 step limit should stay well under 15 minutes

**Optimization Requirements:**
- Minimal Valgrind installation (only memcheck tool)
- Pre-compiled binaries (no compilation in Lambda)
- Efficient trace generation (JSON streaming vs buffering)

### 2.3 Modern Valgrind 3.26.0

**Repository:** https://sourceware.org/git/valgrind.git
**Tag:** VALGRIND_3_26_0 (October 2025)
**Location:** `code-runner/valgrind/` (git submodule)

**Major Improvements Since 3.11.0:**

| Version | Release Date | Key Changes |
|---------|--------------|-------------|
| 3.12.0 | Oct 2016 | ARM64 improvements, DWARF4 enhancements |
| 3.13.0 | June 2017 | Better C++14/17 support, performance improvements |
| 3.14.0 | Oct 2018 | Initial DWARF5 work, better inlining support |
| 3.15.0 | Apr 2019 | More DWARF5 support, glibc 2.29 support |
| 3.16.0 | May 2020 | Python 3 compatibility, better debuginfo handling |
| 3.17.0 | Mar 2021 | **DWARF5 support**, debuginfod support |
| 3.18.0 | Apr 2021 | Faster debuginfo reading, glibc 2.33 support |
| 3.19.0 | Apr 2022 | Better DWARF5, glibc 2.34+ support |
| 3.20.0 | Oct 2022 | Linux 6.x kernel support, performance improvements |
| 3.21.0 | Apr 2023 | Enhanced DWARF5, better C++20 support |
| 3.22.0 | Oct 2023 | Improved inlining, better clang compatibility |
| 3.23.0 | Apr 2024 | More DWARF5 improvements, debuginfo enhancements |
| 3.24.0 | Oct 2024 | Cross-CU improvements, better error reporting |
| 3.25.0 | Apr 2025 | Performance optimizations, modernization |
| 3.26.0 | Oct 2025 | **Inlined subroutine cross-CU rewrite**, GPLv3 |

**Critical Changes for Migration:**

1. **DWARF Version Support:**
   - 3.11.0: DWARF2/3/4 only
   - 3.17.0+: DWARF5 support (critical for GCC 11+)
   - 3.26.0: Improved cross-compilation-unit handling

2. **Debuginfo API Changes:**
   - Inlined function handling rewritten (fixes "UnknownInlinedFun")
   - Better cross-compilation unit type resolution
   - Improved compressed debug symbol support

3. **License:**
   - 3.11.0: GPLv2
   - 3.26.0: GPLv3 (ensure compliance)

4. **VEX IR Changes:**
   - Deprecated IROps removed (Iop_Clz32/64, Iop_Ctz32/64)
   - New VEX API: `LibVEX_set_VexControl`
   - IR structure may have evolved

5. **Syscall Support:**
   - Many new Linux syscalls wrapped
   - Better glibc 2.34+ compatibility
   - Improved file descriptor tracking

---

## 3. Gap Analysis

### 3.1 API Compatibility Assessment

#### 3.1.1 VEX IR Instrumentation

**Risk Level:** MEDIUM

**Current Code (3.11.0):**
```c
case Ist_IMark:
    di = unsafeIRDirty_0_N(1/*regparms*/, "pg_trace_inst", &pg_trace_inst,
         mkIRExprVec_1(IRExpr_Const(IRConst_U64(st->Ist.IMark.addr))));
    stmt('V', &mce, IRStmt_Dirty(di));
    break;
```

**Potential Issues:**
- `Ist_IMark` structure may have changed
- `unsafeIRDirty_0_N` API signature verification needed
- VEX IR type system evolution

**Migration Path:**
1. Review VEX IR changelog between versions
2. Test compilation of instrumentation code
3. Verify `Ist_IMark` still represents instruction boundaries
4. Confirm dirty call mechanism unchanged

**Likelihood of Breaking Changes:** LOW-MEDIUM
**Mitigation:** VEX IR is designed for stability; core concepts likely unchanged

#### 3.1.2 Debug Info API

**Risk Level:** HIGH

**Current API Usage:**
```c
VG_(get_filename)(a, &file)
VG_(get_fnname)(a, &fn)
VG_(get_linenum)(a, &linenum)
VG_(get_fnname_kind_from_IP)(a)
VG_(get_StackTrace)(tid, ips, depth, sps, fps)
```

**Known Changes:**
- DWARF5 support added (3.17.0)
- Inlined subroutine handling rewritten (3.26.0)
- Cross-CU type resolution improved (3.24.0-3.26.0)

**Potential Issues:**
- Type introspection functions may have new APIs
- DWARF reader internals restructured
- Compressed debug info handling

**Migration Requirements:**
1. **API Verification:**
   - Check all `VG_(get_*)` functions still exist
   - Verify return types and parameter signatures
   - Test with DWARF5 debug info

2. **Type System Updates:**
   - Review `tytypes.c` changes needed for DWARF5
   - Update union/struct handling if needed
   - Verify pointer type resolution

**Testing Strategy:**
- Compile simple C++ program with GCC 11 + DWARF5
- Verify all debug info queries work
- Compare type information accuracy

#### 3.1.3 File I/O and System Calls

**Risk Level:** LOW

**Current API Usage:**
```c
VG_(fd_open)("/tmp/stdout.txt", VKI_O_WRONLY|VKI_O_CREAT|VKI_O_TRUNC, 0600)
VG_(dup2)(stdout_fd, 1)
VG_(lseek)(stdout_fd, 0, VKI_SEEK_SET)
VG_(read)(stdout_fd, buffer, size)
VG_(fprintf)(trace_fp, ...)
VG_(malloc) / VG_(free)
```

**Assessment:**
- Core file I/O functions are stable Valgrind APIs
- `VKI_*` constants (Valgrind Kernel Interface) should be compatible
- Memory allocation unchanged

**Verification Needed:**
- Confirm `/tmp` usage in Lambda environment
- Test file descriptor redirection under modern Valgrind
- Verify unbuffered I/O still works correctly

#### 3.1.4 Embedded JSON Library

**Risk Level:** VERY LOW

**Assessment:**
- Standalone code, no external dependencies
- Uses only Valgrind memory allocators
- No OS-specific code
- Should port directly

**Migration Path:**
- Copy JSON library code verbatim
- Test with modern `VG_(malloc)` behavior
- Verify string handling unchanged

### 3.2 Toolchain Compatibility

#### 3.2.1 GCC Version Impact

**GCC 4.8 → GCC 11.5/14.2**

**Debug Info Changes:**
| Aspect | GCC 4.8 | GCC 11.5/14.2 |
|--------|---------|---------------|
| Default DWARF | Version 3/4 | Version 5 |
| Inlining | Limited | Aggressive (requires cross-CU) |
| Variable Location | Simple | Complex (optimized away if -O0 not used) |
| Type Info | Basic | Enhanced (better templates, etc.) |

**Implications:**
- **Must use Valgrind 3.17.0+** for DWARF5 support
- Inlined function handling rewrite in 3.26.0 is beneficial
- May see more accurate type information
- Better C++ template support

**Required Compilation Flags (unchanged):**
```bash
-ggdb           # Maximum debug info (DWARF5 with GCC 11+)
-O0             # No optimization (critical!)
-fno-omit-frame-pointer  # Accurate stack traces
-std=c++17      # Modern C++ (upgrade from c++11)
```

#### 3.2.2 glibc Impact

**glibc 2.17 → glibc 2.34+**

**Changes:**
- Syscall numbers may differ
- New syscall wrappers in Valgrind 3.19.0+ (required for glibc 2.34)
- Better thread support
- Different malloc behavior (non-issue for Valgrind)

**Validation:**
- Test basic I/O operations
- Verify thread creation (if user code uses threads)
- Check memory allocation patterns

#### 3.2.3 Kernel Compatibility

**Kernel 3.x/4.x → Kernel 6.1+**

**Valgrind Support:**
- 3.11.0: Linux kernels up to ~4.2
- 3.20.0+: Linux 6.x kernel support
- 3.26.0: Full Linux 6.x support with all syscalls

**Lambda Environment:**
- Amazon Linux 2023 uses Linux 6.1+
- **Valgrind 3.20.0+ required**
- 3.26.0 provides best compatibility

### 3.3 Feature Parity Checklist

| Feature | SPP-Valgrind 3.11.0 | Required in 3.26.0 | Status |
|---------|---------------------|-------------------|--------|
| Instruction-level tracing | ✓ | ✓ | TO VERIFY |
| Source file filtering (`--source-filename`) | ✓ | ✓ | TO IMPLEMENT |
| Trace output (`--trace-filename`) | ✓ | ✓ | TO IMPLEMENT |
| JSON trace format | ✓ | ✓ | TO PORT |
| Stdout capture | ✓ | ✓ | TO TEST |
| Variable type introspection | ✓ DWARF3/4 | ✓ DWARF5 | TO UPDATE |
| Stack frame tracking | ✓ | ✓ | TO VERIFY |
| Heap variable tracking | ✓ | ✓ | TO VERIFY |
| Global variable tracking | ✓ | ✓ | TO VERIFY |
| Pointer relationship tracking | ✓ | ✓ | TO VERIFY |
| 5,000 step limit | ✓ | ✓ | TO PORT |
| Error redirection to trace | ✓ | ✓ | TO PORT |

### 3.4 Dependency Analysis

#### Current Dependencies (SPP-Valgrind 3.11.0)
```
Build:
- autoconf, automake, libtool
- gcc 4.8+
- make

Runtime:
- Linux kernel 3.x+
- glibc 2.17+
```

#### Target Dependencies (Valgrind 3.26.0)
```
Build:
- autoconf 2.69+, automake 1.16+
- gcc 11.5 or gcc 14.2
- make

Runtime:
- Linux kernel 6.1+
- glibc 2.34+
```

**Compatibility:** ✓ Amazon Linux 2023 provides all required dependencies

---

## 4. Architecture Design

### 4.1 Migration Strategy Options

#### Option A: In-Place Modification (Recommended)
**Approach:** Apply modifications directly to Valgrind 3.26.0 source tree

**Process:**
1. Clone Valgrind 3.26.0 (already done as submodule)
2. Create feature branch: `spp-modifications`
3. Apply modifications file by file
4. Test incrementally
5. Maintain as Git branch with clear commit history

**Pros:**
- Clean separation of base code vs modifications
- Easy to rebase on future Valgrind versions
- Clear audit trail via Git
- Standard approach for tool development

**Cons:**
- Need to manually port each modification
- Testing required at each step

**Recommendation:** ✓ RECOMMENDED - industry standard approach

#### Option B: Patch File System
**Approach:** Maintain modifications as `.patch` files applied during build

**Process:**
1. Create patch files for each modification set
2. Apply patches during build process
3. Store patches in `code-runner/valgrind-patches/`

**Pros:**
- Explicit documentation of changes
- Easy to version control patches
- Can be applied to any Valgrind version (with conflicts)

**Cons:**
- Patch conflicts on API changes
- Harder to maintain than Git branch
- Build process complexity

**Recommendation:** Consider for future maintenance, not initial migration

#### Option C: Fork and Merge
**Approach:** Fork Valgrind repository, merge updates periodically

**Pros:**
- Complete control over codebase
- Can diverge if needed

**Cons:**
- Overhead of maintaining fork
- Merge conflicts on updates
- Community contributions harder

**Recommendation:** ✗ NOT RECOMMENDED - overkill for this use case

### 4.2 Proposed Directory Structure

```
code-runner/
├── SPP-Valgrind/              # Legacy (archive, DO NOT DELETE yet)
│   └── [Valgrind 3.11.0 with modifications]
│
├── valgrind/                   # Git submodule (Valgrind 3.26.0)
│   ├── .git                    # Submodule link to sourceware.org
│   ├── memcheck/               # Modified for tracing
│   │   ├── mc_main.c           ← ADD: --source-filename, --trace-filename
│   │   ├── mc_translate.c      ← ADD: pg_trace_inst() hook
│   │   ├── mc_include.h        ← MODIFY: exports
│   │   └── mc_errors.c         ← MODIFY: error redirection
│   ├── coregrind/
│   │   └── m_debuginfo/
│   │       ├── debuginfo.c     ← ADD: JSON library + serialization
│   │       ├── tytypes.c       ← MODIFY: type handling
│   │       └── priv_tytypes.h  ← MODIFY: headers
│   └── include/
│       └── pub_tool_debuginfo.h ← ADD: public API exports
│
├── valgrind-build/             # Build artifacts (gitignored)
│   ├── Makefile
│   └── [compiled binaries]
│
├── valgrind-install/           # Installation prefix (gitignored)
│   └── bin/
│       └── valgrind            # Final binary for Lambda deployment
│
├── lambda/                     # Lambda function code
│   ├── handler.py              # Lambda entry point
│   ├── requirements.txt
│   ├── valgrind/               ← COPY from valgrind-install/
│   └── entrypoint.sh           ← UPDATED for Lambda environment
│
└── Dockerfile.lambda           # New: Lambda-compatible build container
```

**Git Workflow:**
```bash
cd code-runner/valgrind
git checkout -b spp-modifications
# Apply modifications
git add .
git commit -m "Add SPP tracing modifications to memcheck"
```

**Build Workflow:**
```bash
cd code-runner/valgrind
./autogen.sh
./configure --prefix=/path/to/valgrind-install
make -j$(nproc)
make install
```

### 4.3 Code Organization

#### 4.3.1 Modification Modules

**Module 1: Trace Control (mc_main.c)**
- Command-line option parsing
- File descriptor setup
- Initialization and cleanup

**Module 2: Instrumentation Hook (mc_translate.c)**
- VEX IR traversal
- Dirty call injection
- Trace generation logic

**Module 3: Type Introspection (debuginfo.c, tytypes.c)**
- DWARF parsing (update for DWARF5)
- Type serialization
- Variable value extraction

**Module 4: JSON Library (debuginfo.c)**
- Standalone, portable
- No changes expected

**Module 5: Error Handling (mc_errors.c)**
- Error message redirection
- Trace file integration

#### 4.3.2 API Boundary

**Public APIs (need to verify compatibility):**
```c
// From pub_tool_debuginfo.h
Bool VG_(get_filename)(Addr a, const HChar** filename);
Bool VG_(get_fnname)(Addr a, const HChar** fnname);
Bool VG_(get_linenum)(Addr a, UInt* linenum);
Vg_FnNameKind VG_(get_fnname_kind_from_IP)(Addr ip);
UInt VG_(get_StackTrace)(ThreadId tid, Addr* ips, UInt max_n_ips,
                         Addr* sps, Addr* fps, Word first_ip_delta);
```

**Internal APIs (may need updates):**
```c
// Type introspection functions (to be added to pub_tool_debuginfo.h)
void serialize_variable_info(...);  // Needs DWARF5 updates
void enumerate_global_variables(...);
void collect_stack_frame_variables(...);
```

### 4.4 Trace Format

**Maintain compatibility with existing format:**

```
=== pg_trace_inst ===
STDOUT: "[JSON-encoded stdout output]"
{
"func_name": "main",
"line": 42,
"IP": "0x4005c0",
"kind": 0,
[local variables JSON object],
[global variables JSON object],
[heap allocations JSON object],
[stack frames JSON array]
}
```

**No format changes planned** - ensures backend compatibility

### 4.5 Build System Integration

#### 4.5.1 Development Build
```bash
#!/bin/bash
# build-valgrind-dev.sh

cd code-runner/valgrind

# Configure with development options
./autogen.sh
./configure \
    --prefix=/path/to/SeePlusPlus/code-runner/valgrind-install \
    --enable-only64bit \
    --disable-all-tools \
    --enable-tool=memcheck \
    CFLAGS="-O2 -g"

# Build
make -j$(nproc)
make install
```

#### 4.5.2 Lambda Build
```bash
#!/bin/bash
# build-valgrind-lambda.sh

# Build in Amazon Linux 2023 container
docker run --rm -v $(pwd):/work \
    public.ecr.aws/amazonlinux/amazonlinux:2023 \
    /bin/bash -c "
        yum install -y gcc gcc-c++ make automake autoconf git
        cd /work/code-runner/valgrind
        ./autogen.sh
        ./configure \
            --prefix=/tmp/valgrind-install \
            --enable-only64bit \
            --disable-all-tools \
            --enable-tool=memcheck
        make -j\$(nproc)
        make install
    "

# Copy to Lambda deployment directory
cp -r /tmp/valgrind-install code-runner/lambda/valgrind
```

#### 4.5.3 Docker Image (Alternative)
```dockerfile
# Dockerfile.lambda
FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install build dependencies
RUN yum install -y gcc gcc-c++ make automake autoconf git

# Copy Valgrind source
COPY code-runner/valgrind /valgrind-src

# Build and install
WORKDIR /valgrind-src
RUN ./autogen.sh && \
    ./configure --prefix=/opt/valgrind \
                --enable-only64bit \
                --disable-all-tools \
                --enable-tool=memcheck && \
    make -j$(nproc) && \
    make install

# Install Python and Lambda runtime
RUN yum install -y python3.11
COPY code-runner/lambda /lambda

WORKDIR /lambda
CMD ["python3", "handler.py"]
```

---

## 5. Implementation Plan

### 5.1 Phase 1: Environment Setup and Validation (Week 1, Days 1-2)

#### Tasks:
1. **Verify Valgrind 3.26.0 Baseline**
   - ✓ Clone as submodule (DONE)
   - Build unmodified Valgrind on Amazon Linux 2023
   - Run basic memcheck tests
   - Verify DWARF5 support with GCC 11 compiled code

2. **Create Development Environment**
   - Set up Docker container with AL2023
   - Install GCC 11.5, autotools, development headers
   - Create build scripts

3. **API Compatibility Testing**
   - Compile simple test tool using public debuginfo APIs
   - Verify `VG_(get_filename)`, `VG_(get_fnname)`, etc. still work
   - Test VEX IR instrumentation with dummy dirty call

**Deliverables:**
- Working Valgrind 3.26.0 build on AL2023
- API compatibility report
- Development container setup

**Success Criteria:**
- Unmodified Valgrind 3.26.0 compiles and runs
- Basic memcheck functionality works
- Debug info APIs accessible

### 5.2 Phase 2: Core Tracing Infrastructure (Week 1, Days 3-5)

#### Task 1: Port Command-Line Options (mc_main.c)
**Lines to modify:** ~70 lines

**Changes:**
1. Add option definitions:
   ```c
   static const HChar* pg_source_filename = NULL;
   static const HChar* pg_trace_filename = NULL;
   ```

2. Add option parsing in `mc_process_cmd_line_option()`:
   ```c
   if VG_STR_CLO(arg, "--source-filename", pg_source_filename) {}
   else if VG_STR_CLO(arg, "--trace-filename", pg_trace_filename) {}
   ```

3. Add file descriptor setup in `mc_post_clo_init()`:
   ```c
   // Open trace file
   trace_fp = VG_(fopen)(pg_trace_filename, VKI_O_WRONLY|VKI_O_CREAT|VKI_O_TRUNC, 0644);

   // Redirect stdout to /tmp/stdout.txt
   stdout_fd = VG_(fd_open)("/tmp/stdout.txt", VKI_O_WRONLY|VKI_O_CREAT|VKI_O_TRUNC, 0600);
   VG_(dup2)(stdout_fd, 1);
   ```

4. Add cleanup in `mc_fini()`:
   ```c
   VG_(fclose)(trace_fp);
   VG_(close)(stdout_fd);
   ```

**Testing:**
- Verify options accepted without errors
- Check files created correctly
- Test stdout redirection

#### Task 2: Implement Instrumentation Hook (mc_translate.c)
**Lines to add:** ~350 lines

**Changes:**
1. Add function declaration:
   ```c
   VG_REGPARM(1) void pg_trace_inst(Addr ad);
   ```

2. Add helper structures:
   ```c
   OSet* pg_encoded_addrs = NULL;
   char user_stdout_buf[10 * 1024 * 1024];
   ```

3. Implement `pg_trace_inst()` function:
   ```c
   VG_REGPARM(1)
   void pg_trace_inst(Addr a) {
       // File filtering
       const HChar *file;
       Bool hasfile = VG_(get_filename)(a, &file);
       if (!hasfile || !VG_STREQ(file, pg_source_filename)) return;

       // Step limiting
       n_steps++;
       if (n_steps > MAX_STEPS) {
           VG_(fprintf)(trace_fp, "MAX_STEPS_EXCEEDED\n");
           VG_(exit)(0);
       }

       // Stdout capture
       VG_(lseek)(stdout_fd, 0, VKI_SEEK_SET);
       int nbytes = VG_(read)(stdout_fd, user_stdout_buf, sizeof(user_stdout_buf));
       char* json_stdout = json_encode_string(user_stdout_buf);

       // Debug info queries
       const HChar *fn;
       UInt linenum;
       VG_(get_fnname)(a, &fn);
       VG_(get_linenum)(a, &linenum);

       // Write trace
       VG_(fprintf)(trace_fp, "=== pg_trace_inst ===\n");
       VG_(fprintf)(trace_fp, "STDOUT: %s\n", json_stdout);
       VG_(fprintf)(trace_fp, "{\n");
       VG_(fprintf)(trace_fp, "\"func_name\": \"%s\", \"line\": %d, ...\n", fn, linenum);

       // TODO: Add variable serialization (Phase 3)

       VG_(fprintf)(trace_fp, "}\n");
       VG_(free)(json_stdout);
   }
   ```

4. Add dirty call injection in `mc_instrument()`:
   ```c
   case Ist_IMark:
       di = unsafeIRDirty_0_N(1, "pg_trace_inst", &pg_trace_inst,
            mkIRExprVec_1(IRExpr_Const(IRConst_U64(st->Ist.IMark.addr))));
       stmt('V', &mce, IRStmt_Dirty(di));
       break;
   ```

**Testing:**
- Compile simple C++ program: `int main() { return 0; }`
- Run under modified Valgrind
- Verify trace file created with basic records
- Check stdout capture works

#### Task 3: Port JSON Library (debuginfo.c)
**Lines to add:** ~1,669 lines

**Changes:**
1. Copy JSON library code verbatim from SPP-Valgrind
   - String buffer implementation
   - JSON node structures
   - Encoding/decoding functions

2. Verify memory allocator usage:
   ```c
   VG_(malloc)("json_buffer", size)
   VG_(free)(ptr)
   ```

3. Test JSON encoding:
   ```c
   char* json = json_encode_string("Hello\nWorld");
   // Should produce: "Hello\nWorld" (with proper escaping)
   ```

**Testing:**
- Unit test JSON encoding with special characters
- Verify memory allocation works
- Test with large strings (stdout capture)

**Deliverables:**
- Functional `pg_trace_inst()` hook
- Basic trace file generation
- JSON library integrated

**Success Criteria:**
- Simple programs generate trace files
- Stdout captured correctly
- JSON output valid

### 5.3 Phase 3: Type Introspection and Variable Serialization (Week 2, Days 1-3)

#### Task 1: Update Type System for DWARF5 (tytypes.c)
**Lines to modify:** ~620 lines

**Critical Updates:**
1. **DWARF Version Handling:**
   - Add DWARF5 type tag support
   - Update union handling (already patched in SPP)
   - Verify struct/class field extraction

2. **Type Resolution:**
   - Test cross-compilation-unit types (benefit of 3.26.0)
   - Verify pointer type resolution
   - Check array bounds extraction

3. **Value Extraction:**
   - Confirm memory read functions work
   - Test with modern GCC-optimized code
   - Verify -O0 still preserves variables

**Testing with GCC 11:**
```cpp
// test_types.cpp
struct Point { int x; int y; };
int main() {
    int a = 42;
    Point p = {10, 20};
    int* ptr = &a;
    int arr[3] = {1, 2, 3};
    return 0;
}
```

Compile:
```bash
g++ -std=c++17 -ggdb -O0 -fno-omit-frame-pointer test_types.cpp
```

Expected Trace:
```json
{
  "local_vars": [
    {"name": "a", "type": "int", "value": "42"},
    {"name": "p", "type": "Point", "value": {"x": 10, "y": 20}},
    {"name": "ptr", "type": "int*", "value": "0x...", "points_to": "42"},
    {"name": "arr", "type": "int[3]", "value": [1, 2, 3]}
  ]
}
```

#### Task 2: Implement Variable Serialization (debuginfo.c)
**Lines to add:** ~1,669 lines (additional functions)

**Functions to Port:**
1. `serialize_variable_info()` - Main serialization entry point
2. `enumerate_global_variables()` - Global variable collection
3. `collect_stack_frame_variables()` - Local variable collection
4. `serialize_type_info()` - Type metadata serialization
5. `resolve_pointer_target()` - Pointer relationship tracking

**API Updates for 3.26.0:**
- Verify debuginfo reading APIs
- Update for cross-CU type resolution
- Test with inlined functions

**Integration into pg_trace_inst():**
```c
void pg_trace_inst(Addr a) {
    // ... existing code ...

    // Serialize variables
    VG_(fprintf)(trace_fp, "\"local_vars\": ");
    serialize_local_variables(trace_fp, a, ips, stack_depth);

    VG_(fprintf)(trace_fp, ", \"global_vars\": ");
    serialize_global_variables(trace_fp, a);

    VG_(fprintf)(trace_fp, ", \"heap_vars\": ");
    serialize_heap_variables(trace_fp);

    VG_(fprintf)(trace_fp, "}\n");
}
```

#### Task 3: Export Public APIs (pub_tool_debuginfo.h)
**Lines to add:** ~142 lines

**Changes:**
1. Add function declarations for variable serialization
2. Export type introspection functions
3. Document DWARF5-specific behavior

**Deliverables:**
- Full variable serialization working
- DWARF5 type support verified
- Complete trace format matching legacy

**Success Criteria:**
- All primitive types serialized correctly
- Structs, arrays, pointers handled
- Inlined functions tracked (new in 3.26.0)

### 5.4 Phase 4: Error Handling and Edge Cases (Week 2, Days 4-5)

#### Task 1: Error Redirection (mc_errors.c)
**Lines to modify:** ~48 lines

**Changes:**
- Redirect error messages to trace file
- Preserve error categorization
- Test with memory errors

#### Task 2: Edge Case Handling
**Test Cases:**
1. **Infinite Loops:** Verify 5,000 step limit works
2. **Exceptions:** C++ exceptions captured correctly
3. **Multi-threaded Code:** Main thread traced only
4. **Large Stdout:** Test 10MB limit handling
5. **No Debug Info:** Graceful degradation

#### Task 3: Lambda-Specific Adaptations
**Changes:**
1. **Stdout Capture:** Test `/tmp` usage in Lambda
2. **File Paths:** Ensure `/tmp/stdout.txt` accessible
3. **Permissions:** Verify file creation works
4. **Memory Limits:** Test with Lambda memory constraints

**Deliverables:**
- Robust error handling
- Lambda compatibility verified
- Edge cases handled

**Success Criteria:**
- No crashes on error cases
- Useful error messages in trace
- Lambda environment tested

### 5.5 Phase 5: Build Optimization and Deployment (Week 3, Days 1-2)

#### Task 1: Minimize Valgrind Installation
**Goal:** Reduce deployment package size

**Optimizations:**
1. Build only memcheck tool (`--disable-all-tools --enable-tool=memcheck`)
2. Strip debug symbols from Valgrind binaries
3. Remove unused files (docs, test suites)
4. Enable only x86_64 architecture

**Build Configuration:**
```bash
./configure \
    --prefix=/opt/valgrind \
    --enable-only64bit \
    --disable-all-tools \
    --enable-tool=memcheck \
    --disable-valgrindmi \
    CFLAGS="-O2 -s"  # -s strips symbols
```

**Expected Sizes:**
- Full Valgrind 3.26.0: ~150MB
- Optimized (memcheck only): ~30-40MB
- Lambda limit: 250MB unzipped ✓

#### Task 2: Lambda Deployment Package
**Structure:**
```
lambda-deployment.zip
├── handler.py
├── entrypoint.sh
└── valgrind/
    ├── bin/
    │   └── valgrind
    └── lib/
        └── valgrind/
            └── memcheck-amd64-linux
```

**handler.py Updates:**
```python
import subprocess
import json
import os

def lambda_handler(event, context):
    # Extract code from event
    code = event['code']

    # Write to /tmp/main.cpp
    with open('/tmp/main.cpp', 'w') as f:
        f.write(code)

    # Compile with GCC 11
    compile_result = subprocess.run([
        'g++', '-std=c++17', '-ggdb', '-O0',
        '-fno-omit-frame-pointer',
        '-o', '/tmp/main.out', '/tmp/main.cpp'
    ], capture_output=True, text=True, timeout=30)

    if compile_result.returncode != 0:
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'Compilation failed',
                'stderr': compile_result.stderr
            })
        }

    # Run under Valgrind
    trace_file = '/tmp/main_vgtrace.txt'
    valgrind_result = subprocess.run([
        'stdbuf', '-o0',
        '/opt/valgrind/bin/valgrind',
        '--tool=memcheck',
        '--source-filename=main.cpp',
        f'--trace-filename={trace_file}',
        '/tmp/main.out'
    ], capture_output=True, text=True, timeout=300)

    # Read trace
    with open(trace_file, 'r') as f:
        trace = f.read()

    # Parse and return
    return {
        'statusCode': 200,
        'body': json.dumps({
            'trace': trace,
            'stdout': valgrind_result.stdout,
            'stderr': valgrind_result.stderr
        })
    }
```

#### Task 3: Performance Testing
**Benchmarks:**
1. **Cold Start Time:** Measure first invocation
2. **Execution Time:** Trace generation for various code sizes
3. **Memory Usage:** Peak memory during tracing
4. **Package Size:** Final deployment zip

**Targets:**
- Cold start: <3 seconds
- Execution (100 steps): <2 seconds
- Memory: <512MB
- Package: <50MB

**Deliverables:**
- Optimized Valgrind build
- Lambda deployment package
- Performance benchmark report

**Success Criteria:**
- Deployment package <50MB
- Cold start time acceptable
- All tests pass in Lambda

### 5.6 Phase 6: Testing and Validation (Week 3, Days 3-5)

#### Task 1: Unit Tests
**Test Categories:**
1. **Primitive Types:** int, float, double, char, bool
2. **Pointers:** int*, char*, void*, null pointers
3. **Arrays:** static arrays, multi-dimensional
4. **Structs:** simple structs, nested structs
5. **Classes:** basic classes, inheritance, virtual functions
6. **STL Containers:** vector, map, set (basic)
7. **Control Flow:** loops, recursion, exceptions

#### Task 2: Integration Tests
**Test Scenarios:**
1. **Legacy Compatibility:**
   - Run same code on SPP-Valgrind 3.11.0 and new 3.26.0
   - Compare trace outputs
   - Verify backend parser works

2. **GCC 11 Specific:**
   - Modern C++ features (C++17)
   - DWARF5 debug info
   - Inlined functions

3. **Lambda Environment:**
   - Run in actual Lambda function
   - Test with various memory limits
   - Verify cold start times

#### Task 3: Regression Testing
**Existing See++ Test Suite:**
- Run full suite against new Valgrind
- Fix any backend parser issues
- Update frontend if trace format evolved

**Deliverables:**
- Comprehensive test suite
- Test results documentation
- Bug fixes for any failures

**Success Criteria:**
- All unit tests pass
- Integration tests match legacy behavior
- Lambda deployment successful

---

## 6. Testing Strategy

### 6.1 Test Environment Setup

#### Local Development Environment
```bash
# Docker container for AL2023
docker run -it --rm \
    -v $(pwd):/work \
    -w /work \
    public.ecr.aws/amazonlinux/amazonlinux:2023 \
    /bin/bash

# Install dependencies
yum install -y gcc gcc-c++ make automake autoconf git gdb
```

#### Lambda Emulation (Using SAM CLI)
```bash
sam local invoke SeePlusPlusFunction \
    --event test-event.json \
    --docker-network host
```

### 6.2 Test Categories

#### 6.2.1 Compilation Tests
**Purpose:** Verify Valgrind builds correctly

```bash
# Test 1: Clean build
./autogen.sh && ./configure --prefix=/opt/vg && make

# Test 2: Minimal build (Lambda configuration)
./configure --enable-only64bit --disable-all-tools --enable-tool=memcheck

# Test 3: API compatibility
make check  # Run Valgrind's own test suite
```

#### 6.2.2 Instrumentation Tests
**Purpose:** Verify tracing hook works

**Test 1: Minimal Program**
```cpp
// test_minimal.cpp
int main() {
    return 0;
}
```

Expected:
- At least 1 trace record
- Correct function name: "main"
- Line numbers present

**Test 2: Basic I/O**
```cpp
#include <iostream>
int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
```

Expected:
- Stdout captured: "Hello, World!\n"
- Multiple trace records (one per line)

#### 6.2.3 Type Introspection Tests

**Test 3: Primitive Types**
```cpp
int main() {
    int a = 42;
    float b = 3.14;
    char c = 'x';
    bool d = true;
    return 0;
}
```

Expected JSON:
```json
{
  "local_vars": [
    {"name": "a", "type": "int", "value": "42"},
    {"name": "b", "type": "float", "value": "3.14"},
    {"name": "c", "type": "char", "value": "'x'"},
    {"name": "d", "type": "bool", "value": "true"}
  ]
}
```

**Test 4: Pointers and References**
```cpp
int main() {
    int a = 42;
    int* ptr = &a;
    int& ref = a;
    return 0;
}
```

Expected:
- `ptr` shows address and points_to value 42
- `ref` treated as alias

**Test 5: Structs and Classes**
```cpp
struct Point {
    int x;
    int y;
};

int main() {
    Point p = {10, 20};
    return 0;
}
```

Expected:
```json
{"name": "p", "type": "Point", "value": {"x": 10, "y": 20}}
```

**Test 6: Arrays**
```cpp
int main() {
    int arr[5] = {1, 2, 3, 4, 5};
    return 0;
}
```

Expected:
```json
{"name": "arr", "type": "int[5]", "value": [1, 2, 3, 4, 5]}
```

**Test 7: STL Containers (Basic)**
```cpp
#include <vector>
int main() {
    std::vector<int> v = {1, 2, 3};
    return 0;
}
```

Expected:
- Vector recognized as type
- Internal representation shown (may be complex)

#### 6.2.4 DWARF5 Specific Tests

**Test 8: Inlined Functions (GCC 11+)**
```cpp
inline int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(10, 20);
    return 0;
}
```

Compile with: `g++ -std=c++17 -ggdb -O2` (note: O2 to force inlining)

Expected:
- Function name shows "add" or "main" (not "UnknownInlinedFun")
- Correct line numbers

**Test 9: C++17 Features**
```cpp
#include <optional>
int main() {
    std::optional<int> opt = 42;
    return 0;
}
```

Expected:
- Type information for std::optional
- Value extraction

#### 6.2.5 Error Handling Tests

**Test 10: Memory Error**
```cpp
int main() {
    int* p = new int[10];
    p[100] = 42;  // Out of bounds
    return 0;
}
```

Expected:
- Error captured in trace
- Execution continues or terminates gracefully

**Test 11: Infinite Loop**
```cpp
int main() {
    while (true) { /* infinite */ }
    return 0;
}
```

Expected:
- 5,000 step limit triggered
- "MAX_STEPS_EXCEEDED" in trace

**Test 12: Exception**
```cpp
int main() {
    try {
        throw std::runtime_error("Test exception");
    } catch (...) {
        return 0;
    }
}
```

Expected:
- Exception tracked through stack frames
- Catch block traced

#### 6.2.6 Lambda Environment Tests

**Test 13: File I/O in /tmp**
```python
# Lambda test
event = {
    'code': 'int main() { return 0; }'
}
result = lambda_handler(event, context)
assert result['statusCode'] == 200
```

**Test 14: Memory Limits**
```python
# Test with Lambda memory = 512MB
# Should handle moderate code complexity
```

**Test 15: Timeout Handling**
```python
# Test with code that runs close to timeout
# Verify graceful termination
```

### 6.3 Regression Testing

#### Comparison Framework
```python
# compare_traces.py
import json

def parse_legacy_trace(file_path):
    # Parse SPP-Valgrind 3.11.0 trace
    pass

def parse_new_trace(file_path):
    # Parse Valgrind 3.26.0 trace
    pass

def compare_traces(legacy, new):
    # Compare key fields
    assert legacy['func_name'] == new['func_name']
    assert legacy['line'] == new['line']
    # Compare variable states
    pass

# Run comparison
for test in test_suite:
    legacy_trace = run_legacy(test.code)
    new_trace = run_new(test.code)
    compare_traces(legacy_trace, new_trace)
```

#### Backwards Compatibility Checklist
- [ ] Trace format unchanged
- [ ] Backend parser works without modifications
- [ ] Frontend displays traces correctly
- [ ] All existing test cases pass

### 6.4 Performance Benchmarks

#### Metrics to Collect
1. **Build Time:**
   - Clean build time (Valgrind compilation)
   - Incremental build time

2. **Execution Time:**
   - Trace generation for N steps (N = 10, 100, 1000, 5000)
   - Comparison: 3.11.0 vs 3.26.0

3. **Memory Usage:**
   - Peak memory during tracing
   - Memory per step

4. **Package Size:**
   - Full installation size
   - Minimal deployment size
   - Compressed (zip) size

#### Benchmark Suite
```cpp
// benchmark_small.cpp - 10 steps
int main() {
    int a = 1;
    a += 2;
    return a;
}

// benchmark_medium.cpp - 100 steps
int main() {
    int sum = 0;
    for (int i = 0; i < 20; i++) {
        sum += i;
    }
    return sum;
}

// benchmark_large.cpp - 1000 steps
int main() {
    int sum = 0;
    for (int i = 0; i < 200; i++) {
        sum += i;
    }
    return sum;
}
```

**Expected Performance:**
| Metric | SPP-Valgrind 3.11.0 | Target (3.26.0) |
|--------|---------------------|-----------------|
| Build time | ~10 min | <15 min |
| 10 steps | <0.5s | <0.5s |
| 100 steps | <1s | <1s |
| 1000 steps | <5s | <5s |
| 5000 steps | <20s | <20s |
| Memory peak | ~100MB | <150MB |
| Package size | ~40MB | <50MB |

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| VEX IR API breaking changes | MEDIUM | HIGH | Early prototype testing; fallback to 3.20.0 if needed |
| DWARF5 type parsing issues | LOW | MEDIUM | Extensive testing with GCC 11; validate with GCC 14 |
| Performance degradation | LOW | MEDIUM | Benchmark at each phase; optimize if needed |
| Lambda deployment size limit | LOW | LOW | Minimal build configuration tested |
| Cross-CU type resolution bugs | MEDIUM | MEDIUM | Leverage 3.26.0 improvements; test complex projects |
| Memory errors in Lambda | LOW | MEDIUM | Test with various memory limits |
| Stdout capture failure | LOW | HIGH | Test /tmp access thoroughly; alternative: in-memory buffer |

### 7.2 Project Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timeline overrun | MEDIUM | MEDIUM | Phased approach; can deploy with basic functionality |
| Incomplete type support | LOW | LOW | Prioritize common types; enhance over time |
| Backend parser compatibility | LOW | HIGH | Maintain strict trace format; version if needed |
| Regression in existing features | MEDIUM | HIGH | Comprehensive regression testing; keep 3.11.0 parallel |
| Documentation gaps | MEDIUM | LOW | Document as we build; code comments |

### 7.3 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| License compliance (GPLv3) | LOW | MEDIUM | Review GPLv3 requirements; ensure compliance |
| Dependency updates | LOW | LOW | Submodule makes updates manageable |
| Community divergence | LOW | LOW | Track Valgrind releases; rebase if beneficial |

### 7.4 Contingency Plans

**Plan A: Full Migration (Recommended)**
- Complete all phases as outlined
- Deploy Valgrind 3.26.0 with full feature parity

**Plan B: Partial Migration**
- If Phase 3 (type introspection) proves difficult:
  - Deploy basic tracing (Phases 1-2)
  - Add type support incrementally

**Plan C: Intermediate Version**
- If 3.26.0 has issues:
  - Fall back to 3.20.0 (still has DWARF5, Linux 6.x support)
  - Revisit 3.26.0 in future

**Plan D: Keep Legacy + New**
- Run both versions in parallel
- Route requests based on code complexity
- Gradual migration

---

## 8. Timeline and Milestones

### 8.1 Detailed Schedule

**Week 1: Foundation**
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| Mon | Environment setup, baseline build | Working Valgrind 3.26.0 on AL2023 |
| Tue | API compatibility testing | API compatibility report |
| Wed | Port command-line options | Options parsing working |
| Thu | Implement instrumentation hook | Basic trace generation |
| Fri | Port JSON library | JSON encoding functional |

**Week 2: Core Features**
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| Mon | Update type system for DWARF5 | Type parsing working |
| Tue | Implement variable serialization | Full trace format |
| Wed | Testing with complex types | Type test suite passing |
| Thu | Error handling, edge cases | Robust error handling |
| Fri | Lambda-specific adaptations | Lambda compatibility verified |

**Week 3: Deployment and Testing**
| Day | Tasks | Deliverables |
|-----|-------|--------------|
| Mon | Build optimization | Minimal deployment package |
| Tue | Lambda deployment package | Deployable artifact |
| Wed | Integration testing | All tests passing |
| Thu | Performance benchmarking | Performance report |
| Fri | Documentation, final review | Ready for production |

### 8.2 Milestones

1. **M1: Baseline Established** (Day 2)
   - Valgrind 3.26.0 builds and runs
   - APIs verified compatible

2. **M2: Basic Tracing Working** (Day 5)
   - Trace files generated
   - Stdout captured

3. **M3: Full Type Support** (Day 10)
   - All types serialized correctly
   - DWARF5 working

4. **M4: Lambda Deployment** (Day 14)
   - Lambda function working
   - Performance acceptable

5. **M5: Production Ready** (Day 15)
   - All tests passing
   - Documentation complete

### 8.3 Go/No-Go Decision Points

**Decision Point 1 (Day 2):** API Compatibility
- **Go:** All critical APIs work unchanged
- **No-Go:** Major API breaks → Evaluate 3.20.0 or 3.23.0

**Decision Point 2 (Day 7):** Type Introspection
- **Go:** DWARF5 types parsed correctly
- **No-Go:** Defer complex types, ship basic tracing first

**Decision Point 3 (Day 12):** Lambda Deployment
- **Go:** Package size acceptable, performance good
- **No-Go:** Optimize further or consider alternative deployment

---

## 9. Appendices

### 9.1 Key File Locations

**Legacy Code:**
```
code-runner/SPP-Valgrind/
├── memcheck/mc_main.c              (modifications: lines 50-100)
├── memcheck/mc_translate.c         (modifications: lines 6260-6600)
├── memcheck/mc_include.h           (modifications: exports)
├── memcheck/mc_errors.c            (modifications: error redirection)
├── coregrind/m_debuginfo/debuginfo.c  (additions: ~1669 lines)
├── coregrind/m_debuginfo/tytypes.c    (additions: ~615 lines)
└── include/pub_tool_debuginfo.h    (additions: ~142 lines)
```

**Modern Code (to be modified):**
```
code-runner/valgrind/               [Git submodule]
├── memcheck/mc_main.c              ← ADD OPTIONS
├── memcheck/mc_translate.c         ← ADD HOOK
├── coregrind/m_debuginfo/debuginfo.c  ← ADD JSON + SERIALIZATION
├── coregrind/m_debuginfo/tytypes.c    ← UPDATE FOR DWARF5
└── include/pub_tool_debuginfo.h    ← ADD PUBLIC APIs
```

### 9.2 Valgrind Version Comparison

| Feature | 3.11.0 (2015) | 3.26.0 (2025) |
|---------|---------------|---------------|
| DWARF Support | 2/3/4 | 2/3/4/5 |
| GCC Support | Up to GCC 5 | Up to GCC 14 |
| Linux Kernel | Up to 4.2 | Up to 6.x |
| glibc | Up to 2.22 | Up to 2.40 |
| Inlined Functions | Basic | Cross-CU rewrite |
| License | GPLv2 | GPLv3 |
| Build System | Autotools | Autotools (updated) |

### 9.3 Command Reference

**Build Commands:**
```bash
# Clean build
./autogen.sh
./configure --prefix=/opt/valgrind
make -j$(nproc)
make install

# Minimal build (Lambda)
./configure \
    --prefix=/opt/valgrind \
    --enable-only64bit \
    --disable-all-tools \
    --enable-tool=memcheck
make -j$(nproc) && make install
```

**Compilation Commands:**
```bash
# GCC 11 (DWARF5)
g++ -std=c++17 -ggdb -O0 -fno-omit-frame-pointer -o program program.cpp

# GCC 14 (alternative)
g++-14 -std=c++20 -ggdb -O0 -fno-omit-frame-pointer -o program program.cpp
```

**Execution Commands:**
```bash
# Basic trace
stdbuf -o0 valgrind \
    --tool=memcheck \
    --source-filename=program.cpp \
    --trace-filename=trace.txt \
    ./program

# With additional memcheck options
stdbuf -o0 valgrind \
    --tool=memcheck \
    --leak-check=no \
    --source-filename=program.cpp \
    --trace-filename=trace.txt \
    ./program
```

### 9.4 Useful Resources

**Valgrind Documentation:**
- Main docs: https://valgrind.org/docs/manual/manual.html
- Tool writing guide: https://valgrind.org/docs/manual/writing-tools.html
- VEX IR reference: valgrind/VEX/pub/libvex_ir.h

**DWARF Debugging:**
- DWARF5 spec: http://dwarfstd.org/
- GCC DWARF options: https://gcc.gnu.org/onlinedocs/gcc/Debugging-Options.html
- readelf/objdump for inspection

**Amazon Linux 2023:**
- Toolchain docs: https://docs.aws.amazon.com/linux/al2023/ug/core-glibc.html
- Lambda limits: https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html

**See++ Original Resources:**
- pgbovine's OPT: https://github.com/pgbovine/OnlinePythonTutor
- SPP-Valgrind repo: https://github.com/knazir/SPP-Valgrind

### 9.5 Contact and Support

**For Issues:**
- Valgrind mailing list: valgrind-users@lists.sourceforge.net
- Valgrind bugzilla: https://bugs.kde.org/

**For AL2023:**
- AWS re:Post: https://repost.aws/

---

## 10. Success Metrics

### 10.1 Functional Metrics

- [ ] All primitive types (int, float, char, bool) traced correctly
- [ ] Pointers and references tracked with target resolution
- [ ] Arrays (static and dynamic) serialized
- [ ] Structs and classes with nested fields working
- [ ] STL containers (basic support: vector, map, set)
- [ ] Inlined functions tracked correctly (no "UnknownInlinedFun")
- [ ] Global variables enumerated
- [ ] Stack frames accurate
- [ ] Heap allocations tracked
- [ ] Stdout captured and JSON-encoded
- [ ] Error messages redirected to trace
- [ ] 5,000 step limit enforced
- [ ] Exception handling preserved

### 10.2 Performance Metrics

- [ ] Build time <15 minutes
- [ ] 100-step trace generated in <1 second
- [ ] 5,000-step trace in <20 seconds
- [ ] Memory usage <150MB peak
- [ ] Deployment package <50MB
- [ ] Lambda cold start <3 seconds

### 10.3 Quality Metrics

- [ ] Zero crashes on test suite
- [ ] 100% backwards compatibility with existing traces
- [ ] Backend parser works without modification
- [ ] Frontend displays new traces correctly
- [ ] Code coverage >80% for modified code
- [ ] Documentation complete
- [ ] Code review completed

### 10.4 Deployment Metrics

- [ ] Lambda function deploys successfully
- [ ] Lambda execution succeeds for all test cases
- [ ] Amazon Linux 2023 compatibility verified
- [ ] GCC 11 and GCC 14 both work
- [ ] DWARF5 debug info processed correctly
- [ ] No GPLv3 license violations

---

## 11. Next Steps

### Immediate Actions (Before Implementation)

1. **Review and Approval:**
   - Review this plan with stakeholders
   - Approve timeline and milestones
   - Allocate resources

2. **Environment Preparation:**
   - Set up Amazon Linux 2023 development environment
   - Install GCC 11.5, build tools
   - Clone and verify Valgrind 3.26.0 submodule ✓ (DONE)

3. **Risk Mitigation:**
   - Create backup of SPP-Valgrind 3.11.0 ✓ (Already in repo)
   - Set up parallel testing environment
   - Prepare rollback plan

### Post-Implementation

1. **Deployment:**
   - Deploy to test environment
   - Run full regression suite
   - Deploy to production

2. **Monitoring:**
   - Track performance metrics
   - Monitor error rates
   - Collect user feedback

3. **Future Enhancements:**
   - Support for more STL containers
   - Improved multi-threading support
   - Enhanced visualization features

---

**Document End**

*This plan is a living document and will be updated as implementation progresses.*
