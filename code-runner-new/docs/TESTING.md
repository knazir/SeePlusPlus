# SPP-Valgrind Testing Guide

This document describes how to run the comprehensive test suite for the SPP-Valgrind port.

## Overview

The test suite includes 50+ test programs from the original SPP-Valgrind project, each with a corresponding "golden" reference file that contains the expected trace output.

## Test Scripts

### 1. Quick Test (`run_quick_test.sh`)

Runs a small subset of tests (3 tests) to quickly validate the build.

**Usage:**
```bash
cd /Users/kashif/Development/SeePlusPlus/code-runner
./run_quick_test.sh
```

**Tests included:**
- `shadowing.c` - Variable shadowing
- `basic.c` - Basic trace generation
- `globals.c` - Global variables

**Purpose:**
- Quick validation after code changes
- Debugging test harness issues
- Checking if basic functionality works

---

### 2. Full Test Suite (`run_all_tests.sh`)

Runs all test programs and compares against golden files.

**Usage:**
```bash
cd /Users/kashif/Development/SeePlusPlus/code-runner
./run_all_tests.sh
```

**What it does:**
1. Discovers all `.c` and `.cpp` files in `code-runner-new/valgrind-tests/`
2. For each test:
   - Compiles the program in Docker with debug flags
   - Runs Valgrind with trace generation
   - Compares output against `.golden` file
   - Reports PASS/FAIL status
3. Generates detailed logs and summary report

**Output Files:**
- `test_results_YYYYMMDD_HHMMSS.log` - Detailed test execution log
- `test_summary.log` - Summary of all test results

---

### 3. Phase 6 Build & Test (`build_and_test_phase6.sh`)

Phase-specific test for variable traversal functionality.

**Usage:**
```bash
cd /Users/kashif/Development/SeePlusPlus/code-runner
./build_and_test_phase6.sh
```

**What it does:**
1. Builds Valgrind in Docker
2. Runs trace generation test
3. Verifies variable capture infrastructure
4. Saves results to `phase6_build.log` and `phase6_test.log`

---

## Test Directory Structure

```
code-runner-new/valgrind-tests/
├── shadowing.c              # Test program
├── shadowing.golden         # Expected output
├── basic.c
├── basic.golden
├── ...                      # 50+ test files
├── Makefile
├── golden_test.py           # Python test framework (reference)
└── run_test_from_scratch.py
```

## Understanding Test Results

### Pass Criteria

A test **passes** if:
- ✅ Compilation succeeds
- ✅ Trace generation completes without errors
- ✅ Output matches golden file (after filtering)

### Fail Reasons

A test can **fail** due to:
- ❌ Compilation error
- ❌ Trace generation error (Valgrind crash)
- ❌ Output mismatch with golden file

### Filtering

The test harness applies the same filtering as the original test framework:
- **Memory addresses**: `0x[hex]` → `0xADDR`
- **Object IDs**: `"123":` → `"ID":`
- **Reference IDs**: `"REF", 123` → `"REF", ID`

This prevents spurious failures due to non-deterministic memory layout.

## Test Categories

### Basic Tests
- `shadowing.c` - Variable shadowing
- `basic.c` - Basic types and variables
- `globals.c` - Global variables

### Array Tests
- `array-param.c` - Array parameters
- `array-overflow.c` - Array overflow detection
- `string-array.c` - String arrays

### Pointer Tests
- `pointer-chain.c` - Pointer chains
- `pointers-gone-wild.c` - Complex pointer manipulation
- `fjalar-PointerTest.c` - Comprehensive pointer tests

### Struct Tests
- `struct-basic.c` - Basic structs
- `structs-and-arrays.c` - Structs with arrays
- `fjalar-NestedStructTest.c` - Nested structs

### C++ Tests
- `cpp-first.cpp` - Basic C++
- `cpp-class-basic.cpp` - C++ classes
- `cpp-inheritance.cpp` - Inheritance
- `cpp-virtual-method.cpp` - Virtual methods

### Complex Tests
- `fjalar-functions.c` - Function calls
- `fjalar-small-test.c` - Complex integration test
- `cpp-stack-inline.cpp` - Stack with inline functions

## Debugging Failed Tests

### 1. Check Compilation Error
```bash
cat test_results_*.log | grep -A10 "COMPILATION FAILED"
```

### 2. Check Trace Generation Error
```bash
cat test_results_*.log | grep -A10 "TRACE GENERATION FAILED"
```

### 3. View Diff for Failed Test
```bash
# Example for shadowing test
diff code-runner-new/valgrind-tests/shadowing.golden \
     code-runner-new/valgrind-tests/shadowing.out
```

### 4. Manual Test Run
```bash
# Compile
docker run --rm \
  -v /path/to/valgrind-tests:/workspace/tests \
  valgrind-builder \
  gcc -ggdb -O0 -fno-omit-frame-pointer -o /workspace/tests/shadowing \
      /workspace/tests/shadowing.c

# Run trace
docker run --rm \
  -v /path/to/valgrind:/workspace/valgrind \
  -v /path/to/valgrind-tests:/workspace/tests \
  valgrind-builder \
  /workspace/valgrind/vg-in-place --tool=memcheck \
    --source-filename=shadowing.c \
    --trace-filename=/workspace/tests/shadowing.vgtrace \
    /workspace/tests/shadowing
```

## Expected Test Status (Phase 6)

After Phase 6 completion:
- **Variable Traversal Functions**: ✅ Implemented
- **Basic Trace Generation**: ✅ Working
- **Variable Value Capture**: ⚠️  Partial (infrastructure in place, integration pending)

### Known Limitations
- Heap tracking not yet implemented
- Some complex C++ features may fail
- Python Tutor format conversion not yet available

## Current Test Results

To view the latest test results:
```bash
# View summary
cat /Users/kashif/Development/SeePlusPlus/code-runner/test_summary.log

# View detailed log
less /Users/kashif/Development/SeePlusPlus/code-runner/test_results_*.log
```

## Running Specific Tests

To run a single test manually:
```bash
cd /Users/kashif/Development/SeePlusPlus/code-runner-new/valgrind-tests

# Compile
gcc -ggdb -O0 -fno-omit-frame-pointer -o shadowing shadowing.c

# Run with Valgrind (in Docker)
docker run --rm \
  -v $PWD:/workspace/tests \
  -v /path/to/valgrind:/workspace/valgrind \
  valgrind-builder \
  /workspace/valgrind/vg-in-place --tool=memcheck \
    --source-filename=shadowing.c \
    --trace-filename=/workspace/tests/shadowing.vgtrace \
    /workspace/tests/shadowing
```

## Continuous Integration

The test harness is designed to integrate with CI/CD:
- Exit code 0 = all tests passed
- Exit code 1 = some tests failed
- Detailed logs saved for debugging

## Contributing

When adding new tests:
1. Add `.c` or `.cpp` file to `valgrind-tests/`
2. Generate golden file with working implementation
3. Commit both files
4. Run full test suite to verify

## Troubleshooting

### Docker Issues
```bash
# Verify Docker image exists
docker images | grep valgrind-builder

# Rebuild if needed
cd /path/to/valgrind
docker build -t valgrind-builder .
```

### Permission Issues
```bash
# Make scripts executable
chmod +x run_all_tests.sh
chmod +x run_quick_test.sh
chmod +x build_and_test_phase6.sh
```

### Disk Space
Large test suites can generate significant output:
```bash
# Check disk usage
du -sh code-runner-new/valgrind-tests/*.out

# Clean up old test outputs
rm code-runner-new/valgrind-tests/*.out
rm code-runner/test_results_*.log
```
