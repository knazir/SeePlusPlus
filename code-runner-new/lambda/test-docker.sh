#!/bin/bash
# Test Lambda container locally with Docker

set -e

echo "================================"
echo "Testing Lambda Container Locally"
echo "================================"
echo ""

# Check if image exists
if ! docker image inspect spp-lambda-trace:latest &> /dev/null; then
    echo "ERROR: Docker image not found"
    echo "Run ./build-docker.sh first"
    exit 1
fi

echo "✓ Docker image found"
echo ""

# Test event
TEST_EVENT="${1:-test-events/simple.json}"

if [ ! -f "$TEST_EVENT" ]; then
    echo "ERROR: Test event file not found: $TEST_EVENT"
    exit 1
fi

echo "Using test event: $TEST_EVENT"
echo ""

# Extract the event body
EVENT_DATA=$(cat "$TEST_EVENT")

echo "Starting Lambda container..."
echo ""

# Run container with test event
docker run --rm \
    --platform linux/amd64 \
    -p 9000:8080 \
    spp-lambda-trace:latest &

CONTAINER_PID=$!

# Wait for container to start
echo "Waiting for container to start..."
sleep 5

# Invoke the function
echo ""
echo "Invoking Lambda function..."
echo ""

curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
    -d "$EVENT_DATA" \
    -H "Content-Type: application/json" \
    | jq '.'

echo ""

# Stop container
kill $CONTAINER_PID 2>/dev/null || true

echo ""
echo "================================"
echo "Test Complete!"
echo "================================"
