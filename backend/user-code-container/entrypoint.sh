#!/bin/bash

set -e

# Ensure a file was passed
if [ -z "$1" ]; then
    echo "Usage: docker run --rm -v /tmp/<your_file.cpp>:/<your_file>.cpp user-code-image /<your_file>.cpp"
    exit 1
fi

SRC_FILE="$1"
EXE_FILE="/usercode/usercode.out"
TRACE_FILE="/usercode/usercode.vgtrace"

# Compile the user-provided C++ file and run under Valgrind
g++ -std=c++11 -ggdb -O0 -fno-omit-frame-pointer -o "$EXE_FILE" "$SRC_FILE"
stdbuf -o0 /spp-valgrind/inst/bin/valgrind --tool=memcheck --source-filename="$SRC_FILE" --trace-filename="$TRACE_FILE" "$EXE_FILE"

# Display the trace output
cat "$TRACE_FILE"
