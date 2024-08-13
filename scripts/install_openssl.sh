#!/bin/sh

set -e

# Set OpenSSL version and installation directory
OPENSSL_VERSION=1.0.2u
OPENSSL_DIR=$HOME/.openssl

# Remove any existing OpenSSL installation
rm -rf $OPENSSL_DIR

# Download, extract, compile, and install OpenSSL
curl -O https://www.openssl.org/source/openssl-$OPENSSL_VERSION.tar.gz
tar xzf openssl-$OPENSSL_VERSION.tar.gz
cd openssl-$OPENSSL_VERSION
./config --prefix=$OPENSSL_DIR --openssldir=$OPENSSL_DIR
make
make install

# Clean up installation files
cd ..
rm -rf openssl-$OPENSSL_VERSION*

# Ensure OpenSSL binaries and libraries are usable
export PATH=$OPENSSL_DIR/bin:$PATH
export LD_LIBRARY_PATH=$OPENSSL_DIR/lib:$LD_LIBRARY_PATH

echo "OpenSSL $OPENSSL_VERSION installed at $OPENSSL_DIR"
