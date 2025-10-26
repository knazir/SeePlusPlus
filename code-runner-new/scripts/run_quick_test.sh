#!/bin/bash
# Quick Test - Run a few simple tests to validate the test harness

set -e

VALGRIND_DIR="/Users/kashif/Development/SeePlusPlus/code-runner/valgrind"
TEST_DIR="/Users/kashif/Development/SeePlusPlus/code-runner-new/valgrind-tests"
RESULTS_DIR="/Users/kashif/Development/SeePlusPlus/code-runner"

# Quick tests - just run these few simple ones
QUICK_TESTS=(
    "shadowing.c"
    "basic.c"
    "globals.c"
)

echo "=========================================="
echo "Quick Test - Running ${#QUICK_TESTS[@]} Tests"
echo "=========================================="
echo ""

PASSED=0
FAILED=0

for test_name in "${QUICK_TESTS[@]}"; do
    basename="${test_name%.*}"
    extension="${test_name##*.}"
    echo "Testing: ${test_name}"

    # Compile
    if [ "${extension}" = "cpp" ]; then
        COMPILER="g++"
    else
        COMPILER="gcc"
    fi

    echo "  Compiling..."
    docker run --rm --entrypoint /bin/bash \
        -v "${TEST_DIR}:/workspace/tests" \
        valgrind-builder \
        -c "cd /workspace/tests && ${COMPILER} -ggdb -O0 -fno-omit-frame-pointer -o ${basename} ${test_name}" 2>&1

    if [ $? -ne 0 ]; then
        echo "  ✗ Compilation failed"
        FAILED=$((FAILED + 1))
        continue
    fi

    # Run trace
    echo "  Running trace..."
    docker run --rm --entrypoint /bin/bash \
        -v "${VALGRIND_DIR}:/workspace/valgrind" \
        -v "${TEST_DIR}:/workspace/tests" \
        valgrind-builder \
        -c "cd /workspace/valgrind && ./vg-in-place --tool=memcheck --source-filename=${test_name} --trace-filename=/workspace/tests/${basename}.vgtrace /workspace/tests/${basename}" \
        > "${TEST_DIR}/${basename}.out" 2>&1

    if [ $? -ne 0 ]; then
        echo "  ✗ Trace generation failed"
        FAILED=$((FAILED + 1))
        continue
    fi

    # Compare (simple check - just verify file was created)
    if [ -f "${TEST_DIR}/${basename}.out" ]; then
        echo "  ✓ Trace generated successfully"

        # Show first 30 lines of output
        echo "  First 30 lines of trace:"
        head -30 "${TEST_DIR}/${basename}.out"
        echo ""

        PASSED=$((PASSED + 1))
    else
        echo "  ✗ No output file generated"
        FAILED=$((FAILED + 1))
    fi

    echo ""
done

echo "=========================================="
echo "Quick Test Summary"
echo "=========================================="
echo "Passed: ${PASSED}"
echo "Failed: ${FAILED}"
echo ""

if [ ${FAILED} -gt 0 ]; then
    echo "⚠️  Some tests failed"
    exit 1
else
    echo "✓ All quick tests passed!"
    exit 0
fi
