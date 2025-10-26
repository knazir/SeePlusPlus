#!/bin/bash
# Docker-based test harness for SPP-Valgrind trace generation
# Tests the simplest program: shadowing.c inside Docker container

set -e  # Exit on error

echo "========================================="
echo "SPP-Valgrind Trace Generation Test (Docker)"
echo "========================================="
echo ""

docker run --rm --entrypoint /bin/bash \
  -v /Users/kashif/Development/SeePlusPlus:/workspace \
  valgrind-builder -c '
set -e

VALGRIND_DIR="/workspace/code-runner/valgrind"
TEST_DIR="/workspace/code-runner-new/valgrind-tests"
TEST_NAME="shadowing"
TEST_FILE="${TEST_DIR}/${TEST_NAME}.c"
TRACE_FILE="/tmp/${TEST_NAME}.vgtrace"
BINARY="/tmp/${TEST_NAME}"

echo "[1/4] Compiling ${TEST_NAME}.c..."
gcc -ggdb -O0 -fno-omit-frame-pointer "${TEST_FILE}" -o "${BINARY}"
echo "✓ Compilation successful: ${BINARY}"
echo ""

if [ -f "${TRACE_FILE}" ]; then
    echo "[2/4] Removing old trace file..."
    rm "${TRACE_FILE}"
fi
echo "[2/4] Ready to generate trace"
echo ""

echo "[3/4] Running through Valgrind..."
echo "Note: Using filename only (not full path) for --source-filename"
cd "${VALGRIND_DIR}"
./vg-in-place --tool=memcheck --source-filename="${TEST_NAME}.c" --trace-filename="${TRACE_FILE}" "${BINARY}" 2>&1 || true
echo ""

echo "[4/4] Checking results..."
if [ -f "${TRACE_FILE}" ]; then
    TRACE_SIZE=$(wc -l < "${TRACE_FILE}")
    echo "✓ Trace file generated: ${TRACE_FILE}"
    echo "✓ Trace size: ${TRACE_SIZE} lines"
    echo ""
    echo "First 100 lines of trace:"
    echo "----------------------------------------"
    head -100 "${TRACE_FILE}"
    echo "----------------------------------------"
    echo ""
    echo "Last 30 lines of trace:"
    echo "----------------------------------------"
    tail -30 "${TRACE_FILE}"
    echo "----------------------------------------"
    echo ""
    echo "✓✓✓ TEST PASSED ✓✓✓"
else
    echo "✗✗✗ TEST FAILED ✗✗✗"
    echo "Trace file not generated!"
    exit 1
fi
'
