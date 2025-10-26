#!/bin/bash
# Test See++ Lambda function locally

set -e

echo "================================"
echo "Testing Lambda Function Locally"
echo "================================"
echo ""

# Check if built
if [ ! -d ".aws-sam" ]; then
    echo "ERROR: Function not built. Run ./build.sh first"
    exit 1
fi

# Test event
TEST_EVENT="${1:-test-events/simple.json}"

if [ ! -f "$TEST_EVENT" ]; then
    echo "ERROR: Test event file not found: $TEST_EVENT"
    echo ""
    echo "Available test events:"
    ls -1 test-events/
    exit 1
fi

echo "Using test event: $TEST_EVENT"
echo ""

# Invoke function
echo "Invoking Lambda function..."
echo ""

sam local invoke TraceExecutionFunction \
    --event "$TEST_EVENT" \
    --docker-network host

echo ""
echo "================================"
echo "Test Complete!"
echo "================================"
