#!/bin/bash
# Wrapper script to run tests in Docker container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Build Docker image if needed
IMAGE_NAME="spp-valgrind-dev"

echo "Building Docker image..."
docker build -t "$IMAGE_NAME" "$SCRIPT_DIR"

echo ""
echo "Running tests in Docker container..."
docker run --rm \
    -v "$SCRIPT_DIR:/workspace" \
    -w /workspace \
    "$IMAGE_NAME" \
    ./test.sh "$@"
