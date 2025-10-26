#!/bin/bash
# Comprehensive Test Harness for SPP-Valgrind
# Runs all test programs and compares against golden files

set -e

# Directories
VALGRIND_DIR="/Users/kashif/Development/SeePlusPlus/code-runner/valgrind"
TEST_DIR="/Users/kashif/Development/SeePlusPlus/code-runner-new/valgrind-tests"
RESULTS_DIR="/Users/kashif/Development/SeePlusPlus/code-runner"
TEST_LOG="${RESULTS_DIR}/test_results_$(date +%Y%m%d_%H%M%S).log"
SUMMARY_LOG="${RESULTS_DIR}/test_summary.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Arrays to track results
declare -a FAILED_TEST_NAMES
declare -a PASSED_TEST_NAMES
declare -a SKIPPED_TEST_NAMES

echo "==========================================" | tee -a "${TEST_LOG}"
echo "SPP-Valgrind Test Suite" | tee -a "${TEST_LOG}"
echo "==========================================" | tee -a "${TEST_LOG}"
echo "Start Time: $(date)" | tee -a "${TEST_LOG}"
echo "" | tee -a "${TEST_LOG}"

# Function to compile and run a single test
run_single_test() {
    local test_file=$1
    local basename=$(basename "${test_file}" | sed 's/\.[^.]*$//')
    local extension="${test_file##*.}"
    local golden_file="${TEST_DIR}/${basename}.golden"
    local output_file="${TEST_DIR}/${basename}.out"

    echo "[${TOTAL_TESTS}] Testing: ${basename}.${extension}" | tee -a "${TEST_LOG}"

    # Check if golden file exists
    if [ ! -f "${golden_file}" ]; then
        echo "  ⚠️  SKIPPED - No golden file found" | tee -a "${TEST_LOG}"
        SKIPPED_TESTS=$((SKIPPED_TESTS + 1))
        SKIPPED_TEST_NAMES+=("${basename}")
        return
    fi

    # Determine compiler
    if [ "${extension}" = "cpp" ]; then
        COMPILER="g++"
    else
        COMPILER="gcc"
    fi

    # Compile in Docker
    echo "  Compiling ${basename}..." | tee -a "${TEST_LOG}"
    docker run --rm --entrypoint /bin/bash \
        -v "${TEST_DIR}:/workspace/tests" \
        valgrind-builder \
        -c "cd /workspace/tests && ${COMPILER} -ggdb -O0 -fno-omit-frame-pointer -o ${basename} ${basename}.${extension}" \
        >> "${TEST_LOG}" 2>&1

    if [ $? -ne 0 ]; then
        echo "  ${RED}✗ COMPILATION FAILED${NC}" | tee -a "${TEST_LOG}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("${basename} (compilation)")
        return
    fi

    # Run with Valgrind
    echo "  Running trace generation..." | tee -a "${TEST_LOG}"
    docker run --rm --entrypoint /bin/bash \
        -v "${VALGRIND_DIR}:/workspace/valgrind" \
        -v "${TEST_DIR}:/workspace/tests" \
        valgrind-builder \
        -c "cd /workspace/valgrind && ./vg-in-place --tool=memcheck --source-filename=${basename}.${extension} --trace-filename=/workspace/tests/${basename}.vgtrace /workspace/tests/${basename}" \
        > "${output_file}" 2>&1

    if [ $? -ne 0 ]; then
        echo "  ${RED}✗ TRACE GENERATION FAILED${NC}" | tee -a "${TEST_LOG}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("${basename} (trace gen)")
        return
    fi

    # Filter output (remove memory addresses for comparison)
    # Apply the same filtering as golden_test.py
    sed -i '' 's/0x[0-9A-Fa-f]\+/0xADDR/g' "${output_file}"
    sed -i '' 's/"\([0-9]\+\)":/\"ID\":/g' "${output_file}"

    # Compare with golden file
    if diff -q <(cat "${golden_file}" | sed 's/0x[0-9A-Fa-f]\+/0xADDR/g' | sed 's/"\([0-9]\+\)":/\"ID\":/g') \
               "${output_file}" > /dev/null 2>&1; then
        echo "  ${GREEN}✓ PASSED${NC}" | tee -a "${TEST_LOG}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        PASSED_TEST_NAMES+=("${basename}")
    else
        echo "  ${RED}✗ FAILED - Output differs from golden${NC}" | tee -a "${TEST_LOG}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        FAILED_TEST_NAMES+=("${basename}")

        # Show first 20 lines of diff
        echo "  First 20 lines of diff:" >> "${TEST_LOG}"
        diff -u <(cat "${golden_file}" | sed 's/0x[0-9A-Fa-f]\+/0xADDR/g') \
                "${output_file}" | head -20 >> "${TEST_LOG}" 2>&1 || true
    fi

    # Cleanup binary
    docker run --rm \
        -v "${TEST_DIR}:/workspace/tests" \
        valgrind-builder \
        /bin/bash -c "rm -f /workspace/tests/${basename}" \
        >> "${TEST_LOG}" 2>&1 || true
}

# Find all test files
echo "Discovering test files..." | tee -a "${TEST_LOG}"
TEST_FILES=()

for test_file in "${TEST_DIR}"/*.c "${TEST_DIR}"/*.cpp; do
    if [ -f "${test_file}" ]; then
        TEST_FILES+=("${test_file}")
    fi
done

echo "Found ${#TEST_FILES[@]} test files" | tee -a "${TEST_LOG}"
echo "" | tee -a "${TEST_LOG}"

# Run all tests
for test_file in "${TEST_FILES[@]}"; do
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    run_single_test "${test_file}"
    echo "" | tee -a "${TEST_LOG}"
done

# Generate Summary
echo "==========================================" | tee "${SUMMARY_LOG}"
echo "Test Suite Summary" | tee -a "${SUMMARY_LOG}"
echo "==========================================" | tee -a "${SUMMARY_LOG}"
echo "End Time: $(date)" | tee -a "${SUMMARY_LOG}"
echo "" | tee -a "${SUMMARY_LOG}"
echo "Total Tests:   ${TOTAL_TESTS}" | tee -a "${SUMMARY_LOG}"
echo "Passed:        ${GREEN}${PASSED_TESTS}${NC}" | tee -a "${SUMMARY_LOG}"
echo "Failed:        ${RED}${FAILED_TESTS}${NC}" | tee -a "${SUMMARY_LOG}"
echo "Skipped:       ${YELLOW}${SKIPPED_TESTS}${NC}" | tee -a "${SUMMARY_LOG}"
echo "" | tee -a "${SUMMARY_LOG}"

if [ ${PASSED_TESTS} -gt 0 ]; then
    PASS_RATE=$(echo "scale=2; ${PASSED_TESTS} * 100 / ${TOTAL_TESTS}" | bc)
else
    PASS_RATE=0
fi
echo "Pass Rate:     ${PASS_RATE}%" | tee -a "${SUMMARY_LOG}"
echo "" | tee -a "${SUMMARY_LOG}"

# List failed tests
if [ ${FAILED_TESTS} -gt 0 ]; then
    echo "${RED}Failed Tests:${NC}" | tee -a "${SUMMARY_LOG}"
    for test_name in "${FAILED_TEST_NAMES[@]}"; do
        echo "  - ${test_name}" | tee -a "${SUMMARY_LOG}"
    done
    echo "" | tee -a "${SUMMARY_LOG}"
fi

# List skipped tests
if [ ${SKIPPED_TESTS} -gt 0 ]; then
    echo "${YELLOW}Skipped Tests:${NC}" | tee -a "${SUMMARY_LOG}"
    for test_name in "${SKIPPED_TEST_NAMES[@]}"; do
        echo "  - ${test_name}" | tee -a "${SUMMARY_LOG}"
    done
    echo "" | tee -a "${SUMMARY_LOG}"
fi

# List passed tests
if [ ${PASSED_TESTS} -gt 0 ]; then
    echo "${GREEN}Passed Tests:${NC}" | tee -a "${SUMMARY_LOG}"
    for test_name in "${PASSED_TEST_NAMES[@]}"; do
        echo "  - ${test_name}" | tee -a "${SUMMARY_LOG}"
    done
    echo "" | tee -a "${SUMMARY_LOG}"
fi

echo "Detailed log: ${TEST_LOG}" | tee -a "${SUMMARY_LOG}"
echo "Summary log:  ${SUMMARY_LOG}" | tee -a "${SUMMARY_LOG}"
echo "" | tee -a "${SUMMARY_LOG}"

# Also display summary to stdout
cat "${SUMMARY_LOG}"

# Exit with error if any tests failed
if [ ${FAILED_TESTS} -gt 0 ]; then
    echo "${RED}⚠️  Some tests failed!${NC}"
    exit 1
else
    echo "${GREEN}✓✓✓ All tests passed!${NC}"
    exit 0
fi
