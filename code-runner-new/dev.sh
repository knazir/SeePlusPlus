#!/bin/bash
# Development helper script for SPP-Valgrind

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VALGRIND_DIR="$SCRIPT_DIR/valgrind"

cd "$VALGRIND_DIR"

# Parse command
case "${1:-help}" in
    build)
        echo "Building Valgrind..."
        if [ ! -f "configure" ]; then
            ./autogen.sh
        fi
        if [ ! -f "Makefile" ]; then
            ./configure --prefix="$PWD/inst"
        fi
        make -j$(nproc)
        echo "Build complete! Use './dev.sh test FILE' to test a C/C++ file"
        ;;

    clean)
        echo "Cleaning build artifacts..."
        make clean 2>/dev/null || true
        rm -f configure Makefile
        echo "Clean complete!"
        ;;

    test)
        if [ -z "$2" ]; then
            echo "Usage: $0 test <file.c|file.cpp>"
            exit 1
        fi

        TEST_FILE="$2"
        BASE_NAME="${TEST_FILE%.*}"
        EXT="${TEST_FILE##*.}"

        if [ ! -f "$TEST_FILE" ]; then
            echo "Error: File '$TEST_FILE' not found"
            exit 1
        fi

        echo "Compiling $TEST_FILE..."
        if [ "$EXT" = "c" ]; then
            gcc -ggdb -O0 -fno-omit-frame-pointer -o "${BASE_NAME}.exe" "$TEST_FILE"
        elif [ "$EXT" = "cpp" ]; then
            g++ -ggdb -O0 -fno-omit-frame-pointer -o "${BASE_NAME}.exe" "$TEST_FILE"
        else
            echo "Error: Unknown file extension '$EXT'"
            exit 1
        fi

        echo "Running Valgrind..."
        ./vg-in-place \
            --tool=pgprint \
            --log-file="${BASE_NAME}.vgtrace" \
            --read-var-info=yes \
            "${BASE_NAME}.exe"

        echo "Converting to OPT trace format..."
        python3 "$SCRIPT_DIR/tests/vg_to_opt_trace.py" \
            --create_jsvar=trace \
            "$BASE_NAME" > "${BASE_NAME}.trace.js"

        echo ""
        echo "Files generated:"
        echo "  - ${BASE_NAME}.exe (executable)"
        echo "  - ${BASE_NAME}.vgtrace (raw Valgrind trace)"
        echo "  - ${BASE_NAME}.trace.js (OPT trace format)"
        ;;

    *)
        echo "SPP-Valgrind Development Helper"
        echo ""
        echo "Usage: $0 COMMAND [ARGS]"
        echo ""
        echo "Commands:"
        echo "  build        Build Valgrind"
        echo "  clean        Clean build artifacts"
        echo "  test FILE    Compile and trace a C/C++ file"
        echo ""
        echo "Examples:"
        echo "  $0 build"
        echo "  $0 test example.c"
        ;;
esac
