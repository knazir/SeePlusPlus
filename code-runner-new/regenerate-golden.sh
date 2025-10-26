#!/bin/bash
# Regenerate golden files from current trace output
# This creates new golden files for all test cases

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALGRIND_DIR="$SCRIPT_DIR/valgrind"
TESTS_DIR="$SCRIPT_DIR/tests"
EXAMPLES_DIR="$TESTS_DIR/examples"
VG_TO_OPT="$TESTS_DIR/vg_to_opt_trace.py"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running in Docker
if [ ! -f "$VALGRIND_DIR/vg-in-place" ]; then
    echo -e "${RED}ERROR: This script must be run inside the Docker container${NC}"
    echo "Usage: ./run-tests.sh --regenerate-golden"
    exit 1
fi

# Regenerate golden file for a single test
regenerate_golden() {
    local test_file="$1"
    local base_name="${test_file%.*}"
    local extension="${test_file##*.}"

    echo -n "Regenerating $test_file... "

    # Compile the program
    local exe_file="$base_name.exe"
    if [ "$extension" = "c" ]; then
        gcc -ggdb -O0 -fno-omit-frame-pointer -o "$exe_file" "$test_file" 2>/dev/null
    elif [ "$extension" = "cpp" ]; then
        g++ -ggdb -O0 -fno-omit-frame-pointer -o "$exe_file" "$test_file" 2>/dev/null
    else
        echo -e "${YELLOW}SKIP${NC} (unknown extension)"
        return 0
    fi

    if [ ! -f "$exe_file" ]; then
        echo -e "${RED}FAIL${NC} (compilation failed)"
        return 1
    fi

    # Run Valgrind to generate trace
    local vgtrace_file="$base_name.vgtrace"
    "$VALGRIND_DIR/vg-in-place" \
        --tool=memcheck \
        --trace-filename="$vgtrace_file" \
        --source-filename="$test_file" \
        --read-var-info=yes \
        "$exe_file" > /dev/null 2>&1

    if [ ! -f "$vgtrace_file" ]; then
        echo -e "${RED}FAIL${NC} (valgrind failed)"
        rm -f "$exe_file"
        return 1
    fi

    # Convert to OPT trace format
    local golden_file="$base_name.golden"
    python3 "$VG_TO_OPT" --create_jsvar=trace "$base_name" > "$golden_file" 2>&1

    if [ ! -f "$golden_file" ]; then
        echo -e "${RED}FAIL${NC} (trace conversion failed)"
        rm -f "$exe_file" "$vgtrace_file"
        return 1
    fi

    echo -e "${GREEN}OK${NC}"

    # Clean up temporary files
    rm -f "$exe_file" "$vgtrace_file"
    return 0
}

# Main execution
main() {
    local pattern="*"

    # Parse arguments
    if [ $# -gt 0 ]; then
        pattern="$1"
    fi

    echo "========================================="
    echo "Regenerating Golden Files"
    echo "========================================="

    cd "$EXAMPLES_DIR"

    local total=0
    local success=0
    local failed=0

    for test_file in $pattern.c $pattern.cpp; do
        if [ -f "$test_file" ]; then
            total=$((total + 1))
            if regenerate_golden "$test_file"; then
                success=$((success + 1))
            else
                failed=$((failed + 1))
            fi
        fi
    done

    echo ""
    echo "========================================="
    echo "Summary"
    echo "========================================="
    echo "Total:    $total"
    echo -e "Success:  ${GREEN}$success${NC}"
    echo -e "Failed:   ${RED}$failed${NC}"
    echo ""

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}All golden files regenerated successfully!${NC}"
        exit 0
    else
        echo -e "${RED}Some golden files failed to regenerate.${NC}"
        exit 1
    fi
}

main "$@"
