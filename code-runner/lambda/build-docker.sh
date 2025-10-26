#!/bin/bash
# Build Lambda container image directly with Docker (no SAM required)

set -e

# Default to production build
BUILD_TYPE="${1:-prod}"

if [[ ! "$BUILD_TYPE" =~ ^(dev|prod)$ ]]; then
    echo "ERROR: Invalid build type. Use: dev or prod"
    echo "Usage: ./build-docker.sh [dev|prod]"
    exit 1
fi

DOCKERFILE="Dockerfile.${BUILD_TYPE}"

echo "================================"
echo "Building Lambda Docker Image"
echo "Build Type: $BUILD_TYPE"
echo "Dockerfile: $DOCKERFILE"
echo "================================"
echo ""

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    echo "ERROR: $DOCKERFILE not found"
    exit 1
fi

# Check if Valgrind is built
if [ ! -f "SPP-Valgrind/vg-in-place" ]; then
    echo "ERROR: Valgrind not found at SPP-Valgrind/vg-in-place"
    echo "Please build Valgrind first or ensure SPP-Valgrind/ directory exists"
    exit 1
fi

echo "✓ Valgrind found"
echo ""

# Build from parent directory (code-runner) so paths work
cd ..

echo "Building Docker image..."
# Build with explicit platform for Lambda compatibility
docker build \
    --platform linux/amd64 \
    --provenance=false \
    --sbom=false \
    -t spp-lambda-trace:latest \
    -f "lambda/$DOCKERFILE" \
    .

echo ""
echo "================================"
echo "Build Complete!"
echo "================================"
echo ""
echo "Image: spp-lambda-trace:latest"
echo "Build Type: $BUILD_TYPE"
echo ""
echo "Next steps:"
echo "  1. Test locally:  cd lambda && ./test-docker.sh"
echo "  2. Deploy to AWS: ./deploy-to-aws.sh [test|prod] us-west-2"
echo ""
