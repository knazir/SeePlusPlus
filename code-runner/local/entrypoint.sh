#!/bin/bash
#
# Local development entrypoint for C++ trace generation
# Mirrors Lambda handler.py logic but uses volume mounts
#

set -euo pipefail

# File paths (from volume mounts)
CPP_FILE="/input/main.cpp"
EXE_FILE="/tmp/main.out"
TRACE_FILE="/output/main_vgtrace.txt"
CC_STDOUT="/output/main_cc_out.txt"
CC_STDERR="/output/main_cc_err.txt"
STDOUT_FILE="/output/main_out.txt"
STDERR_FILE="/output/main_err.txt"

# Valgrind binary path (matches Lambda)
VALGRIND_BIN="/opt/valgrind/bin/valgrind"

echo "Starting C++ code execution..."

# Compile C++ code (same flags as handler.py)
echo "Compiling code..."
g++ -std=c++11 -ggdb -O0 -fno-omit-frame-pointer \
    "$CPP_FILE" -o "$EXE_FILE" \
    > "$CC_STDOUT" 2> "$CC_STDERR"

COMPILE_EXIT=$?

if [ $COMPILE_EXIT -ne 0 ]; then
    echo "Compilation failed with exit code $COMPILE_EXIT"
    exit 0
fi

echo "Compilation successful"

# Run under Valgrind (same options as handler.py)
# Use the same FD redirection approach as Lambda for stdout handling
# This allows Valgrind to lseek and read from stdout
echo "Running under Valgrind..."

PROGRAM_STDOUT="/tmp/program_stdout.txt"

# Redirect FD 1 to a file opened for read-write (same as Lambda)
exec 1<>"$PROGRAM_STDOUT"

stdbuf -o0 "$VALGRIND_BIN" \
    --tool=memcheck \
    --source-filename=$(basename "$CPP_FILE") \
    --trace-filename="$TRACE_FILE" \
    --read-var-info=yes \
    "$EXE_FILE" 2> "$STDERR_FILE" || true

# Copy program stdout to output (redirect back to stdout first for logging)
exec 1>&2
if [ -f "$PROGRAM_STDOUT" ]; then
    cat "$PROGRAM_STDOUT" > "$STDOUT_FILE"
    echo "Program output captured"
else
    touch "$STDOUT_FILE"
fi

echo "Execution complete"
