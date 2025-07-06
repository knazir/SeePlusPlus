#!/bin/bash

set -euo pipefail

# File paths
SRC_FILE="/main.cpp"
EXE_FILE="/main.out"
TRACE_FILE="/main_vgtrace.txt"
CC_STDOUT_FILE="/main_cc_out.txt"
CC_STDERR_FILE="/main_cc_err.txt"
VAL_STDOUT_FILE="/main_out.txt"
VAL_STDERR_FILE="/main_err.txt"

# Check if running in AWS mode
if [ -n "${BUCKET:-}" ]; then
    echo "Running in AWS mode, downloading code from S3"
    
    # Download source code from S3
    aws s3 cp "s3://${BUCKET}/${CODE_KEY}" "${SRC_FILE}"

    echo "Compiling user code"
    
    # Compile the user-provided C++ file
    g++-4.8 -std=c++11 -ggdb -O0 -fno-omit-frame-pointer \
        -o "$EXE_FILE" \
        "$SRC_FILE" > "$CC_STDOUT_FILE" 2> "$CC_STDERR_FILE"
    
    # Capture compilation exit code
    COMPILATION_EXIT_CODE=$?

    echo "Uploading compilation outputs"
    
    # Upload compilation outputs
    aws s3 cp "$CC_STDOUT_FILE" "s3://${BUCKET}/${CC_STDOUT_KEY}" || true
    aws s3 cp "$CC_STDERR_FILE" "s3://${BUCKET}/${CC_STDERR_KEY}" || true
    
    # If compilation fails, exit gracefully
    if [ $COMPILATION_EXIT_CODE -ne 0 ]; then
        echo "Compilation failed with exit code $COMPILATION_EXIT_CODE"
        exit 0
    fi
    
    # Run under Valgrind to generate trace
    echo "Running Valgrind"
    stdbuf -o0 /spp-valgrind/inst/bin/valgrind \
           --tool=memcheck \
           --source-filename="$SRC_FILE" \
           --trace-filename="$TRACE_FILE" \
           "$EXE_FILE" > "$VAL_STDOUT_FILE" 2> "$VAL_STDERR_FILE"

    # Cat contents of all the files
    echo "CC_STDOUT:"
    cat "$CC_STDOUT_FILE"
    echo "CC_STDERR:"
    cat "$CC_STDERR_FILE"
    echo "VAL_STDOUT:"
    cat "$VAL_STDOUT_FILE"
    echo "VAL_STDERR:"
    cat "$VAL_STDERR_FILE"
    
    # Upload results to S3
    echo "Uploading results to S3"
    aws s3 cp "$TRACE_FILE" "s3://${BUCKET}/${TRACE_KEY}" || true
    aws s3 cp "$VAL_STDOUT_FILE" "s3://${BUCKET}/${STDOUT_KEY}" || true
    aws s3 cp "$VAL_STDERR_FILE" "s3://${BUCKET}/${STDERR_KEY}" || true
    
    echo "Execution completed"
else
    # Local mode - use mounted volumes
    echo "Running in local mode, compiling user code"
    
    # Compile the user-provided C++ file
    g++-4.8 -std=c++11 -ggdb -O0 -fno-omit-frame-pointer \
        -o "$EXE_FILE" \
        "$SRC_FILE" > "$CC_STDOUT_FILE" 2> "$CC_STDERR_FILE"
    
    # Capture compilation exit code
    COMPILATION_EXIT_CODE=$?

    echo "Compiled user code with exit code $COMPILATION_EXIT_CODE"
    
    # If compilation fails, exit gracefully
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
fi