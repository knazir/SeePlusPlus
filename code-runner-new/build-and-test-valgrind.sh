#!/bin/bash
# Build and test Valgrind in Docker container

set -e  # Exit on error

echo "========================================="
echo "Valgrind Build and Test Script"
echo "========================================="
echo ""

# Navigate to valgrind directory
cd /workspace/valgrind

# Clean previous builds if they exist
if [ -f Makefile ]; then
    echo "Cleaning previous build..."
    make clean || true
fi

# Generate configure script
echo "Running autogen.sh..."
./autogen.sh

# Configure Valgrind
echo ""
echo "Configuring Valgrind..."
./configure --prefix=$PWD/inst

# Build Valgrind
echo ""
echo "Building Valgrind (this may take a few minutes)..."
make -j$(nproc)

# Check if build succeeded
if [ ! -f ./vg-in-place ]; then
    echo "ERROR: Build failed - vg-in-place not found"
    exit 1
fi

echo ""
echo "========================================="
echo "Build successful!"
echo "========================================="
echo ""

# Run a simple test
echo "Running basic Valgrind test..."
echo ""

# Create a simple test program
cat > /tmp/test.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>

int main() {
    int x = 42;
    int y = 10;
    int z = x + y;

    printf("Result: %d\n", z);

    // Test heap allocation
    int *arr = malloc(10 * sizeof(int));
    for (int i = 0; i < 10; i++) {
        arr[i] = i * 2;
    }
    printf("Array[5]: %d\n", arr[5]);
    free(arr);

    return 0;
}
EOF

# Compile test program with debug info
echo "Compiling test program..."
gcc -g -o /tmp/test /tmp/test.c

# Run with Valgrind
echo ""
echo "Running test program with Valgrind..."
echo "========================================="
./vg-in-place --tool=memcheck --leak-check=no /tmp/test
echo "========================================="
echo ""

# Check if Phase 2 Part 1 modifications are present
echo "Verifying Phase 2 Part 1 modifications..."
echo ""

# Check for fullname field in header
if grep -q "const HChar\* fullname.*pgbovine" include/pub_tool_debuginfo.h; then
    echo "✓ StackBlock.fullname field found in header"
else
    echo "✗ WARNING: StackBlock.fullname field not found"
fi

if grep -q "pg_get_di_handle_at_ip" include/pub_tool_debuginfo.h; then
    echo "✓ pg_get_di_handle_at_ip declaration found in header"
else
    echo "✗ WARNING: pg_get_di_handle_at_ip declaration not found"
fi

# Check for implementation
if grep -q "UWord pg_get_di_handle_at_ip" coregrind/m_debuginfo/debuginfo.c; then
    echo "✓ pg_get_di_handle_at_ip implementation found"
else
    echo "✗ WARNING: pg_get_di_handle_at_ip implementation not found"
fi

if grep -q "block.fullname = var->name.*pgbovine" coregrind/m_debuginfo/debuginfo.c; then
    echo "✓ StackBlock fullname assignment found"
else
    echo "✗ WARNING: StackBlock fullname assignment not found"
fi

if grep -q "gb.fullname = var->name.*pgbovine" coregrind/m_debuginfo/debuginfo.c; then
    echo "✓ GlobalBlock fullname assignment found"
else
    echo "✗ WARNING: GlobalBlock fullname assignment not found"
fi

echo ""
echo "========================================="
echo "All checks complete!"
echo "========================================="
echo ""
echo "Valgrind is built and ready at: $PWD/inst"
echo "To run manually: ./vg-in-place --tool=memcheck <program>"
echo ""
