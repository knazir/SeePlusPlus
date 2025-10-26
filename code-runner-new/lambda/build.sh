#!/bin/bash
# Build script for See++ Lambda function

set -e

echo "================================"
echo "Building See++ Lambda Function"
echo "================================"
echo ""

# Check if Valgrind is built
if [ ! -f "../valgrind/vg-in-place" ]; then
    echo "ERROR: Valgrind not found at ../valgrind/vg-in-place"
    echo "Please build Valgrind first:"
    echo "  cd ../valgrind"
    echo "  ./autogen.sh"
    echo "  ./configure"
    echo "  make -j\$(nproc)"
    exit 1
fi

echo "✓ Valgrind found"
echo ""

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "ERROR: AWS SAM CLI not found"
    echo "Install with: pip install aws-sam-cli"
    exit 1
fi

echo "✓ SAM CLI found"
echo ""

# Build with SAM
echo "Building Lambda container image..."
sam build

echo ""
echo "================================"
echo "Build Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Test locally:  ./test-local.sh"
echo "  2. Deploy to AWS: ./deploy.sh [dev|test|prod]"
echo ""
