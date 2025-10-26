# Building Valgrind with Docker

This guide explains how to build and test the modified Valgrind using Docker with Amazon Linux 2023.

## Quick Start

### 1. Build the Docker Image

```bash
cd code-runner
docker build -f Dockerfile.valgrind-build -t valgrind-builder .
```

### 2. Run the Build and Test Script

```bash
docker run --rm \
  -v $(pwd)/valgrind:/workspace/valgrind \
  valgrind-builder \
  /workspace/valgrind/../build-and-test-valgrind.sh
```

Or with the script from the project root:

```bash
docker run --rm \
  -v $(pwd):/workspace \
  valgrind-builder \
  /workspace/code-runner/build-and-test-valgrind.sh
```

### 3. Interactive Development

For interactive development and testing:

```bash
docker run --rm -it \
  -v $(pwd)/valgrind:/workspace/valgrind \
  -v $(pwd)/code-runner-new/valgrind-tests:/workspace/tests \
  valgrind-builder \
  /bin/bash
```

Then inside the container:

```bash
cd /workspace/valgrind
./autogen.sh
./configure --prefix=$PWD/inst
make -j$(nproc)

# Run tests
./vg-in-place --tool=memcheck /workspace/tests/basic
```

## Detailed Instructions

### Build Process

The build script (`build-and-test-valgrind.sh`) performs the following:

1. **Clean**: Removes previous build artifacts
2. **Autogen**: Generates configure script with `./autogen.sh`
3. **Configure**: Runs `./configure --prefix=$PWD/inst`
4. **Build**: Compiles Valgrind with `make -j$(nproc)`
5. **Test**: Runs a simple C program with Valgrind
6. **Verify**: Checks that Phase 2 Part 1 modifications are present

### Verification Checks

The script verifies these Phase 2 Part 1 modifications:

- ✓ `StackBlock.fullname` field in `pub_tool_debuginfo.h`
- ✓ `GlobalBlock.fullname` field in `pub_tool_debuginfo.h`
- ✓ `pg_get_di_handle_at_ip()` declaration in `pub_tool_debuginfo.h`
- ✓ `pg_get_di_handle_at_ip()` implementation in `debuginfo.c`
- ✓ `fullname` assignments in stack variable code
- ✓ `fullname` assignments in global variable code

### Manual Testing

After building, you can test with any C/C++ program:

```bash
# Inside the container
cd /workspace/valgrind

# Compile a test program with debug info
gcc -g -o test myprogram.c

# Run with Valgrind
./vg-in-place --tool=memcheck test
```

### Testing with valgrind-tests Suite

```bash
docker run --rm -it \
  -v $(pwd):/workspace \
  valgrind-builder \
  /bin/bash

# Inside container
cd /workspace/code-runner-new/valgrind-tests

# Compile a test
gcc -g -o basic basic.c

# Run with Valgrind
/workspace/code-runner/valgrind/vg-in-place --tool=memcheck ./basic
```

## Troubleshooting

### Build Fails

**Problem**: `make` fails with errors

**Solutions**:
1. Check that all Phase 2 Part 1 modifications are correct
2. Look for syntax errors in modified files
3. Check the error messages carefully
4. Ensure `autogen.sh` completed successfully

### Docker Build Fails

**Problem**: `docker build` fails

**Solutions**:
1. Ensure you have internet connectivity (needs to download packages)
2. Check Docker has enough disk space
3. Try building with `--no-cache` flag

### Volume Mount Issues

**Problem**: Changes not reflected in container

**Solutions**:
1. Ensure you're mounting the correct directory
2. Use absolute paths in volume mounts
3. Check file permissions

## Architecture Notes

### Amazon Linux 2023

This Dockerfile uses `public.ecr.aws/lambda/provided:al2023` which provides:

- **Base**: Fedora-based distribution
- **Architecture**: x86_64 (default) or arm64
- **Glibc**: Modern version compatible with Valgrind
- **Kernel**: Linux 6.x headers

### Supported Platforms

Valgrind supports:
- ✅ x86_64 Linux (most common)
- ✅ aarch64 Linux (ARM64)
- ❌ arm64-darwin (Apple Silicon Mac)

### Build Time

- **First build**: 5-10 minutes (depending on CPU cores)
- **Incremental builds**: 1-2 minutes (after `make clean`)
- **Docker image build**: 1-2 minutes (downloading packages)

## CI/CD Integration

This Docker setup can be used in CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Build Valgrind
  run: |
    docker build -f code-runner/Dockerfile.valgrind-build -t valgrind-builder .
    docker run --rm \
      -v ${{ github.workspace }}:/workspace \
      valgrind-builder \
      /workspace/code-runner/build-and-test-valgrind.sh
```

## Next Steps

After successful build and verification:

1. ✅ Phase 2 Part 1 modifications confirmed working
2. ⏭️ Ready to proceed with Phase 2 Part 2 (JSON library)
3. 📝 Document any build warnings or issues
4. 🧪 Run full test suite from `valgrind-tests/`
