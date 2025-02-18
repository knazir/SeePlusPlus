FROM ubuntu:16.04

# Install dependencies required for building Valgrind and running user code
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ make autoconf automake libtool libc6-dbg && \
    rm -rf /var/lib/apt/lists/*  # Clean up to reduce image size

# Build Valgrind in the container
# The -fcommon flag is needed to allow multiple global definitions (legacy behavior)
# TODO: Probably better to fix that in the SPP-Valgrind, also consider deleting all other Valgrind files
COPY SPP-Valgrind/ /spp-valgrind
WORKDIR /spp-valgrind
RUN ./autogen.sh && \
    ./configure --prefix=/spp-valgrind/inst CFLAGS="-fcommon" && \
    make -j$(nproc) && \
    make install

# Setup user code working directory
RUN mkdir /usercode
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Wait for a provided C++ file
ENTRYPOINT ["/entrypoint.sh"]
