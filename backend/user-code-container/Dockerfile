FROM --platform=linux/amd64 ubuntu:14.04

# Install dependencies required for building Valgrind and running user code
# Install gcc-4.8 specifically to match the required platform
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc-4.8 g++-4.8 make autoconf automake libtool libc6-dbg && \
    update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-4.8 100 && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-4.8 100 && \
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
RUN touch /spp_stdout.txt
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Wait for a provided C++ file
ENTRYPOINT ["/entrypoint.sh"]
