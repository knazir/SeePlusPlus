# Dockerfile for SPP-Valgrind 3.26.0 development and testing
# Based on Amazon Linux 2023 to match AWS Lambda runtime

FROM public.ecr.aws/amazonlinux/amazonlinux:2023

# Install all required dependencies
RUN yum update -y && \
    yum install -y \
    # Core build tools
    gcc \
    gcc-c++ \
    make \
    automake \
    autoconf \
    libtool \
    git \
    # Development headers
    glibc-devel \
    # Debugging and testing tools
    gdb \
    strace \
    diffutils \
    # Python for test scripts
    python3 \
    python3-pip \
    # Utilities
    vim \
    wget \
    tar \
    bzip2 \
    xz \
    which \
    findutils \
    && yum clean all

# Set working directory
WORKDIR /workspace

# Environment variables
ENV PATH="/workspace/valgrind/inst/bin:${PATH}"

# Default command
CMD ["/bin/bash"]
