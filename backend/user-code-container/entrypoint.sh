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

# So I'm taking a break from this for now. Here are the notes for when I come back to this:
# - In general, it seems like valgrind and other processes running can't write to anything outside / (e.g. /tmp, /spp, etc.)
# - This also seems to apply to the /tmp stdout piped file from the valgrind modifications, so I tried rerouting that to /spp_stdout.txt
# - This also didn't seem to work however, and the output is always blank. The trace runs but the user program's stdout is not captured step-by-step.
# - Definitely going to need to revisit this...
