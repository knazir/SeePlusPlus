#!/bin/bash
# Wrapper script to run tests in Docker container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build Docker image if needed
IMAGE_NAME="spp-valgrind-dev"

echo "Building Docker image for linux/amd64..."
docker build --platform linux/amd64 -t "$IMAGE_NAME" "$SCRIPT_DIR"

echo ""
echo "Running tests in Docker container..."
docker run --rm \
    --platform linux/amd64 \
    -v "$SCRIPT_DIR:/workspace" \
    -w /workspace/tests/examples \
    "$IMAGE_NAME" \
    python3 golden_test.py "$@"
