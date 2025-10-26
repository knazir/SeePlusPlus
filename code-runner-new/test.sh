#!/bin/bash
# Automated test harness for SPP-Valgrind trace testing
# This script builds Valgrind and tests all examples against golden files

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

# Build Valgrind if needed
build_valgrind() {
    echo "========================================="
    echo "Building Valgrind"
    echo "========================================="

    cd "$VALGRIND_DIR"

    # Check if already built
    if [ -f "./vg-in-place" ] && [ -f "Makefile" ]; then
        echo "Valgrind already built. Skipping build."
        echo "To rebuild, run: make clean in valgrind directory"
        return 0
    fi

    echo "Running autogen.sh..."
    ./autogen.sh

    echo "Configuring..."
    ./configure --prefix="$PWD/inst"

    echo "Building (this may take a few minutes)..."
    make -j$(nproc)

    if [ ! -f "./vg-in-place" ]; then
        echo -e "${RED}ERROR: Build failed - vg-in-place not found${NC}"
        exit 1
    fi

    echo -e "${GREEN}Build successful!${NC}"
    echo ""
}

# Run a single test
run_test() {
    local test_file="$1"
    local base_name="${test_file%.*}"
    local extension="${test_file##*.}"
    local golden_file="$base_name.golden"

    # Skip if no golden file
    if [ ! -f "$golden_file" ]; then
        return 0
    fi

    echo -n "Testing $test_file... "

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
        --tool=pgprint \
        --log-file="$vgtrace_file" \
        --read-var-info=yes \
        "$exe_file" > /dev/null 2>&1

    if [ ! -f "$vgtrace_file" ]; then
        echo -e "${RED}FAIL${NC} (valgrind failed)"
        rm -f "$exe_file"
        return 1
    fi

    # Convert to OPT trace format with JavaScript variable wrapper
    local trace_file="$base_name.trace.js"
    python3 "$VG_TO_OPT" --create_jsvar=trace "$base_name" > "$trace_file" 2>&1

    if [ ! -f "$trace_file" ]; then
        echo -e "${RED}FAIL${NC} (trace conversion failed)"
        rm -f "$exe_file" "$vgtrace_file"
        return 1
    fi

    # Extract just the JSON part from both files (remove "var trace = " prefix and trailing ";")
    # Then normalize by removing all addresses
    local actual_json=$(sed 's/^var trace = //; s/;$//' "$trace_file")
    local golden_json=$(sed 's/^var trace = //; s/;$//' "$golden_file" | grep -v '^ret = ' | grep -v '^rm ')

    # Normalize addresses in both
    local actual_normalized=$(echo "$actual_json" | python3 -c "
import json, sys, re
data = json.load(sys.stdin)
# Normalize addresses
s = json.dumps(data, indent=2, sort_keys=True)
s = re.sub(r'\"0x[0-9A-Fa-f]+\"', '\"0xADDR\"', s)
print(s)
" 2>/dev/null)

    local golden_normalized=$(echo "$golden_json" | python3 -c "
import json, sys, re
data = json.load(sys.stdin)
# Normalize addresses
s = json.dumps(data, indent=2, sort_keys=True)
s = re.sub(r'\"0x[0-9A-Fa-f]+\"', '\"0xADDR\"', s)
print(s)
" 2>/dev/null)

    if [ "$actual_normalized" = "$golden_normalized" ]; then
        echo -e "${GREEN}PASS${NC}"
        # Clean up on success
        rm -f "$exe_file" "$vgtrace_file" "$trace_file"
        return 0
    else
        echo -e "${RED}FAIL${NC} (output mismatch)"
        echo "  Generated trace: $trace_file"
        echo "  Golden file: $golden_file"
        echo "  To see normalized diff: diff <(sed 's/^var trace = //; s/;\$//' $trace_file | python3 -c 'import json,sys,re; d=json.load(sys.stdin); print(re.sub(r\"\\\"0x[0-9A-Fa-f]+\\\"\", \"\\\"0xADDR\\\"\", json.dumps(d,indent=2,sort_keys=True)))') <(sed 's/^var trace = //; s/;\$//' $golden_file | grep -v '^ret = ' | grep -v '^rm ' | python3 -c 'import json,sys,re; d=json.load(sys.stdin); print(re.sub(r\"\\\"0x[0-9A-Fa-f]+\\\"\", \"\\\"0xADDR\\\"\", json.dumps(d,indent=2,sort_keys=True)))')"
        # Keep files for inspection
        return 1
    fi
}

# Main test runner
main() {
    local build_only=false
    local test_pattern="*"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --build-only)
                build_only=true
                shift
                ;;
            --pattern)
                test_pattern="$2"
                shift 2
                ;;
            *)
                echo "Usage: $0 [--build-only] [--pattern PATTERN]"
                echo "  --build-only    Only build Valgrind, don't run tests"
                echo "  --pattern PAT   Only run tests matching pattern (e.g., 'basic*')"
                exit 1
                ;;
        esac
    done

    # Build Valgrind
    build_valgrind

    if [ "$build_only" = true ]; then
        echo "Build complete. Exiting (--build-only specified)."
        exit 0
    fi

    # Run tests
    echo "========================================="
    echo "Running Tests"
    echo "========================================="

    cd "$EXAMPLES_DIR"

    local total=0
    local passed=0
    local failed=0
    local skipped=0

    for test_file in $test_pattern.c $test_pattern.cpp; do
        if [ -f "$test_file" ]; then
            total=$((total + 1))
            if run_test "$test_file"; then
                passed=$((passed + 1))
            else
                failed=$((failed + 1))
            fi
        fi
    done

    echo ""
    echo "========================================="
    echo "Test Summary"
    echo "========================================="
    echo "Total:   $total"
    echo -e "Passed:  ${GREEN}$passed${NC}"
    echo -e "Failed:  ${RED}$failed${NC}"
    echo ""

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}All tests passed!${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed.${NC}"
        exit 1
    fi
}

main "$@"
