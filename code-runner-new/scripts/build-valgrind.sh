#!/bin/bash
# Build script for Valgrind 3.26.0
# This script builds Valgrind with the appropriate configuration for See++

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALGRIND_SRC="$PROJECT_ROOT/code-runner/valgrind"
VALGRIND_BUILD="$PROJECT_ROOT/code-runner-new/valgrind-build"
VALGRIND_INSTALL="$PROJECT_ROOT/code-runner-new/valgrind-install"

# Parse arguments
BUILD_TYPE="${1:-dev}"  # dev, minimal, or full

echo -e "${GREEN}=== Valgrind 3.26.0 Build Script ===${NC}"
echo "Build type: $BUILD_TYPE"
echo "Source: $VALGRIND_SRC"
echo "Build dir: $VALGRIND_BUILD"
echo "Install prefix: $VALGRIND_INSTALL"
echo ""

# Check if source exists
if [ ! -d "$VALGRIND_SRC" ]; then
    echo -e "${RED}Error: Valgrind source not found at $VALGRIND_SRC${NC}"
    echo "Please ensure the git submodule is initialized:"
    echo "  git submodule update --init --recursive"
    exit 1
fi

# Create build directory
mkdir -p "$VALGRIND_BUILD"
mkdir -p "$VALGRIND_INSTALL"

cd "$VALGRIND_SRC"

# Check if autogen.sh has been run
if [ ! -f "configure" ]; then
    echo -e "${YELLOW}Running autogen.sh...${NC}"
    ./autogen.sh
fi

cd "$VALGRIND_BUILD"

# Configure based on build type
case "$BUILD_TYPE" in
    dev)
        echo -e "${YELLOW}Configuring for development (all tools, debug info)...${NC}"
        "$VALGRIND_SRC/configure" \
            --prefix="$VALGRIND_INSTALL" \
            --enable-only64bit \
            CFLAGS="-O2 -g"
        ;;
    minimal)
        echo -e "${YELLOW}Configuring for minimal build (memcheck only, optimized)...${NC}"
        "$VALGRIND_SRC/configure" \
            --prefix="$VALGRIND_INSTALL" \
            --enable-only64bit \
            --disable-all-tools \
            --enable-tool=memcheck \
            CFLAGS="-O2 -s"
        ;;
    full)
        echo -e "${YELLOW}Configuring for full build (all tools, optimized)...${NC}"
        "$VALGRIND_SRC/configure" \
            --prefix="$VALGRIND_INSTALL" \
            --enable-only64bit \
            CFLAGS="-O2"
        ;;
    *)
        echo -e "${RED}Unknown build type: $BUILD_TYPE${NC}"
        echo "Usage: $0 [dev|minimal|full]"
        exit 1
        ;;
esac

# Build
echo -e "${YELLOW}Building Valgrind...${NC}"
NPROC=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
echo "Using $NPROC parallel jobs"
make -j"$NPROC"

# Install
echo -e "${YELLOW}Installing Valgrind to $VALGRIND_INSTALL...${NC}"
make install

# Verify installation
echo -e "${GREEN}Build complete!${NC}"
echo ""
echo "Valgrind binary: $VALGRIND_INSTALL/bin/valgrind"
echo "Version:"
"$VALGRIND_INSTALL/bin/valgrind" --version

echo ""
echo -e "${GREEN}=== Build Summary ===${NC}"
echo "To use this Valgrind:"
echo "  export PATH=$VALGRIND_INSTALL/bin:\$PATH"
echo ""
echo "To run a program:"
echo "  valgrind --tool=memcheck ./your_program"
