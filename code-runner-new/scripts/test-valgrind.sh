#!/bin/bash
# Test script for Valgrind 3.26.0 baseline functionality
# Tests basic memcheck, DWARF5 support, and API compatibility

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALGRIND_INSTALL="$PROJECT_ROOT/code-runner-new/valgrind-install"
TEST_DIR="$PROJECT_ROOT/code-runner-new/valgrind-tests"

# Ensure Valgrind is built
if [ ! -f "$VALGRIND_INSTALL/bin/valgrind" ]; then
    echo -e "${RED}Error: Valgrind not found. Please build it first:${NC}"
    echo "  ./code-runner-new/scripts/build-valgrind.sh dev"
    exit 1
fi

VALGRIND="$VALGRIND_INSTALL/bin/valgrind"

echo -e "${GREEN}=== Valgrind 3.26.0 Test Suite ===${NC}"
echo "Valgrind: $VALGRIND"
echo ""

# Create test directory
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Test counter
PASSED=0
FAILED=0

run_test() {
    local test_name="$1"
    echo -e "${YELLOW}Running: $test_name${NC}"
    if "$@" 2>&1; then
        echo -e "${GREEN}✓ PASSED: $test_name${NC}\n"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED: $test_name${NC}\n"
        ((FAILED++))
    fi
}

# Test 1: Valgrind version
test_version() {
    echo "Checking Valgrind version..."
    "$VALGRIND" --version
    "$VALGRIND" --version | grep -q "valgrind-3.2[0-9]"
}

# Test 2: Basic memcheck
test_basic_memcheck() {
    echo "Testing basic memcheck functionality..."
    cat > test_basic.c <<'EOF'
#include <stdio.h>
int main() {
    printf("Hello, Valgrind!\n");
    return 0;
}
EOF
    gcc -o test_basic test_basic.c
    "$VALGRIND" --tool=memcheck --leak-check=yes ./test_basic > /dev/null 2>&1
}

# Test 3: Memory error detection
test_memory_error() {
    echo "Testing memory error detection..."
    cat > test_error.c <<'EOF'
#include <stdlib.h>
int main() {
    int *p = malloc(10 * sizeof(int));
    p[10] = 42;  // Out of bounds
    free(p);
    return 0;
}
EOF
    gcc -o test_error test_error.c
    "$VALGRIND" --tool=memcheck ./test_error 2>&1 | grep -q "Invalid write"
}

# Test 4: DWARF5 support with GCC 11
test_dwarf5() {
    echo "Testing DWARF5 debug info support..."
    cat > test_dwarf5.cpp <<'EOF'
#include <iostream>
struct Point {
    int x;
    int y;
};

int main() {
    Point p = {10, 20};
    std::cout << "Point: " << p.x << ", " << p.y << std::endl;
    return 0;
}
EOF
    # Compile with DWARF5 (default for GCC 11+)
    g++ -std=c++17 -ggdb -O0 -o test_dwarf5 test_dwarf5.cpp

    # Check that debug info is DWARF5
    if command -v readelf >/dev/null 2>&1; then
        readelf --debug-dump=info test_dwarf5 | head -20
    fi

    # Run under Valgrind - should not complain about DWARF version
    "$VALGRIND" --tool=memcheck ./test_dwarf5 2>&1 | tee valgrind_dwarf5.log

    # Should not have DWARF-related warnings
    ! grep -i "Ignoring non-Dwarf" valgrind_dwarf5.log
}

# Test 5: Debug info access
test_debug_info() {
    echo "Testing debug info (line numbers, function names)..."
    cat > test_debug.cpp <<'EOF'
#include <stdio.h>

void foo() {
    printf("In foo\n");
}

void bar() {
    printf("In bar\n");
}

int main() {
    foo();
    bar();
    return 0;
}
EOF
    g++ -std=c++17 -ggdb -O0 -o test_debug test_debug.cpp

    # Run with Valgrind, should see function names in output
    "$VALGRIND" --tool=memcheck --track-origins=yes ./test_debug 2>&1 | tee debug_info.log

    # Verify we can see function names (this is basic, not full introspection yet)
    grep -q "main" debug_info.log || grep -q "foo" debug_info.log || grep -q "bar" debug_info.log
}

# Test 6: Stack trace accuracy
test_stack_trace() {
    echo "Testing stack trace with frame pointers..."
    cat > test_stack.cpp <<'EOF'
#include <stdlib.h>

void level3() {
    int *p = (int*)malloc(10);
    p[100] = 42;  // Error
    free(p);
}

void level2() {
    level3();
}

void level1() {
    level2();
}

int main() {
    level1();
    return 0;
}
EOF
    g++ -std=c++17 -ggdb -O0 -fno-omit-frame-pointer -o test_stack test_stack.cpp

    "$VALGRIND" --tool=memcheck --num-callers=20 ./test_stack 2>&1 | tee stack_trace.log

    # Should see multiple levels in stack trace
    grep -q "level3" stack_trace.log && \
    grep -q "level2" stack_trace.log && \
    grep -q "level1" stack_trace.log
}

# Test 7: C++17 features
test_cpp17() {
    echo "Testing C++17 code compatibility..."
    cat > test_cpp17.cpp <<'EOF'
#include <optional>
#include <string>
#include <iostream>

int main() {
    std::optional<int> opt = 42;
    if (opt.has_value()) {
        std::cout << "Value: " << *opt << std::endl;
    }
    return 0;
}
EOF
    g++ -std=c++17 -ggdb -O0 -o test_cpp17 test_cpp17.cpp
    "$VALGRIND" --tool=memcheck ./test_cpp17 > /dev/null 2>&1
}

# Test 8: Leak detection
test_leak_detection() {
    echo "Testing memory leak detection..."
    cat > test_leak.c <<'EOF'
#include <stdlib.h>
int main() {
    int *leak = malloc(100);
    // Intentionally not freeing
    return 0;
}
EOF
    gcc -ggdb -O0 -o test_leak test_leak.c
    "$VALGRIND" --tool=memcheck --leak-check=full ./test_leak 2>&1 | grep -q "definitely lost"
}

# Run all tests
run_test test_version
run_test test_basic_memcheck
run_test test_memory_error
run_test test_dwarf5
run_test test_debug_info
run_test test_stack_trace
run_test test_cpp17
run_test test_leak_detection

# Summary
echo ""
echo -e "${GREEN}=== Test Summary ===${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo "Valgrind 3.26.0 baseline is working correctly."
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
