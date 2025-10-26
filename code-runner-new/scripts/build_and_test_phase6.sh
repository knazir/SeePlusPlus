#!/bin/bash
# Phase 6 Build and Test Script
# Builds Valgrind with variable traversal code and runs tests
# Results saved to code-runner directory (not valgrind submodule)

set -e

RESULTS_DIR="/Users/kashif/Development/SeePlusPlus/code-runner"
BUILD_LOG="${RESULTS_DIR}/phase6_build.log"
TEST_LOG="${RESULTS_DIR}/phase6_test.log"

echo "========================================="
echo "Phase 6: Variable Traversal - Build & Test"
echo "========================================="
echo ""

# Step 1: Build in Docker
echo "[1/3] Building Valgrind in Docker..."
docker run --rm --entrypoint /bin/bash \
  -v /Users/kashif/Development/SeePlusPlus:/workspace \
  valgrind-builder -c "
cd /workspace/code-runner/valgrind &&
make clean &&
make -j\$(nproc) 2>&1
" > "${BUILD_LOG}" 2>&1

if [ $? -eq 0 ]; then
    echo "✓ Build successful"
    echo "" >> "${BUILD_LOG}"
    echo "=== BUILD SUCCESSFUL ===" >> "${BUILD_LOG}"
else
    echo "✗ Build failed - check ${BUILD_LOG}"
    tail -50 "${BUILD_LOG}"
    exit 1
fi

# Step 2: Run trace generation test
echo "[2/3] Running trace generation test..."
./test_trace_docker.sh > "${TEST_LOG}" 2>&1

if grep -q "✓✓✓ TEST PASSED ✓✓✓" "${TEST_LOG}"; then
    echo "✓ Test execution successful"
else
    echo "✗ Test execution failed - check ${TEST_LOG}"
    tail -50 "${TEST_LOG}"
    exit 1
fi

# Step 3: Check if variables are captured
echo "[3/3] Verifying variable capture..."
if grep -q '"locals": {}' "${TEST_LOG}"; then
    echo "⚠️  Variables not captured yet (locals empty)"
    echo "    Build succeeded but variables need more work"
    RESULT="PARTIAL"
else
    echo "✓ Variables captured successfully!"
    RESULT="SUCCESS"
fi

# Generate summary
echo ""
echo "========================================="
echo "Phase 6 Results Summary"
echo "========================================="
echo "Build Status: SUCCESS"
echo "Test Status: PASSED"
echo "Variable Capture: ${RESULT}"
echo ""
echo "Log files:"
echo "  Build log: ${BUILD_LOG}"
echo "  Test log:  ${TEST_LOG}"
echo ""

if [ "$RESULT" = "SUCCESS" ]; then
    echo "✓✓✓ PHASE 6 COMPLETE - Ready to commit ✓✓✓"
    exit 0
else
    echo "⚠️  PHASE 6 PARTIAL - More work needed"
    exit 2
fi
