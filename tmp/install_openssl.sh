#!/bin/bash
tmp_dir="$(mktemp -d)"
openssl_version=3.6.5
prefix=/home/minato/.local/opt/openssl-3

curl -fL \
  "https://github.com/openssl/openssl/releases/download/openssl-${openssl_version}/openssl-${openssl_version}.tar.gz" \
  -o "$tmp_dir/openssl.tar.gz"

tar -xzf "$tmp_dir/openssl.tar.gz" -C "$tmp_dir"

cd "$tmp_dir/openssl-${openssl_version}"

./Configure \
  --prefix="$prefix" \
  --openssldir="$prefix/ssl" \
  shared

make -j"$(nproc)"
make test
make install_sw
