# Local development container image for C++ trace generation with Valgrind 3.27.0
# Matches Lambda environment for dev/prod parity
# Based on Amazon Linux 2023
FROM amazonlinux:2023

# Install build dependencies and runtime requirements (same as Lambda)
RUN dnf update -y && \
    dnf install -y \
        gcc \
        gcc-c++ \
        make \
        automake \
        autoconf \
        libtool \
        glibc-devel \
        tar \
        xz \
        which && \
    dnf clean all

# Copy Valgrind source and build it (same as Lambda)
COPY SPP-Valgrind /tmp/valgrind-src
WORKDIR /tmp/valgrind-src

# Build and install Valgrind to /opt/valgrind (same path as Lambda)
RUN ./autogen.sh && \
    ./configure --prefix=/opt/valgrind && \
    make -j$(nproc) && \
    make install && \
    rm -rf /tmp/valgrind-src

# Reset working directory
WORKDIR /workspace

# Copy local entrypoint script (different from Lambda handler.py)
COPY local/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set environment variables (same as Lambda)
ENV PATH="/opt/valgrind/bin:${PATH}"
ENV LD_LIBRARY_PATH="/opt/valgrind/lib:${LD_LIBRARY_PATH}"

# Use bash entrypoint instead of Lambda handler
ENTRYPOINT ["/entrypoint.sh"]
