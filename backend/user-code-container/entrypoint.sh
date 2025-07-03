#!/bin/bash

set -o pipefail

# TODO: Make the usercode prefix load from an env file so it doesn't have to be
# updated both here and in the server
SRC_FILE="/main.cpp"
EXE_FILE="/main.out"
TRACE_FILE="/main_vgtrace.txt"
CC_STDOUT_FILE="/main_cc_out.txt"
CC_STDERR_FILE="/main_cc_err.txt"
VAL_STDOUT_FILE="/main_out.txt"
VAL_STDERR_FILE="/main_err.txt"

# Compile the user-provided C++ file.
g++ -std=c++11 -ggdb -O0 -fno-omit-frame-pointer \
    -o "$EXE_FILE" \
    "$SRC_FILE" > "$CC_STDOUT_FILE" 2> "$CC_STDERR_FILE"

# Capture compilation exit code
COMPILATION_EXIT_CODE=$?

# If compilation fails, write an error message and exit gracefully
if [ $COMPILATION_EXIT_CODE -ne 0 ]; then
    exit 0 
fi

# Run under Valgrind to generate trace
stdbuf -o0 /spp-valgrind/inst/bin/valgrind \
       --tool=memcheck \
       --source-filename="$SRC_FILE" \
       --trace-filename="$TRACE_FILE" \
       "$EXE_FILE" > "$VAL_STDOUT_FILE" 2> "$VAL_STDERR_FILE"

echo "SPP_STDOUT:"
cat /spp_stdout.txt
