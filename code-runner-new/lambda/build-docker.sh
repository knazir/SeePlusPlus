#!/bin/bash
# Build Lambda container image directly with Docker (no SAM required)

set -e

echo "================================"
echo "Building Lambda Docker Image"
echo "================================"
echo ""

# Check if Valgrind is built
if [ ! -f "../valgrind/vg-in-place" ]; then
    echo "ERROR: Valgrind not found at ../valgrind/vg-in-place"
    echo "Please build Valgrind first"
    exit 1
fi

echo "✓ Valgrind found"
echo ""

# Build from parent directory (code-runner-new) so paths work
cd ..

echo "Building Docker image..."
# Build with explicit platform for Lambda compatibility
docker build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    -t spp-lambda-trace:latest \
    -f lambda/Dockerfile \
    .

echo ""
echo "================================"
echo "Build Complete!"
echo "================================"
echo ""
echo "Image: spp-lambda-trace:latest"
echo ""
echo "Next steps:"
echo "  1. Test locally:  cd lambda && ./test-docker.sh"
echo "  2. Push to ECR and create Lambda function"
echo ""
