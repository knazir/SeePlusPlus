#!/bin/bash
# Launch development shell in AL2023 container
# This provides an interactive environment for building and testing Valgrind

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Launching AL2023 Development Shell ==="
echo "Project root: $PROJECT_ROOT"
echo ""
echo "Inside the container, you can:"
echo "  ./code-runner-new/scripts/build-valgrind.sh dev"
echo "  ./code-runner-new/scripts/test-valgrind.sh"
echo ""

# Build the development image if it doesn't exist
docker build -t spp-valgrind-dev -f "$PROJECT_ROOT/code-runner-new/Dockerfile.valgrind-dev" "$PROJECT_ROOT"

# Run interactive shell
docker run --rm -it \
    -v "$PROJECT_ROOT:/work" \
    -w /work \
    spp-valgrind-dev \
    /bin/bash
