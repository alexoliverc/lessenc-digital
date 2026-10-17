#!/bin/sh
set -eu

# All inputs are explicitly acquired and checksum pinned before this offline step.
manifest=/opt/p17-bootstrap/supply-chain.json
inputs=/opt/p17-bootstrap/artifacts
verifier=/opt/p17-bootstrap/p17-toolchain-verify.mjs
mkdir -p /opt/p17-toolchain
node "$verifier" inputs "$manifest" "$inputs" /opt/p17-toolchain/schema-engine
dpkg-deb --extract "$inputs/libssl3_3.0.22-1~deb12u1_amd64.deb" /opt/p17-toolchain/openssl
node "$verifier" libraries "$manifest" /opt/p17-toolchain/openssl/usr/lib/x86_64-linux-gnu
cp /opt/p17-toolchain/openssl/usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/x86_64-linux-gnu/
cp /opt/p17-toolchain/openssl/usr/lib/x86_64-linux-gnu/libcrypto.so.3 /usr/lib/x86_64-linux-gnu/
mkdir /opt/p17-toolchain/npm
tar --extract --gzip --file "$inputs/npm-11.19.1.tgz" --directory /opt/p17-toolchain/npm --strip-components=1 --no-same-owner
node -e 'const p=require("/opt/p17-toolchain/npm/package.json"); if(p.name!=="npm"||p.version!=="11.19.1") process.exit(1)'
chmod -R a+rX,go-w /opt/p17-toolchain
chmod 0555 /opt/p17-toolchain/schema-engine
ln -sf /opt/p17-toolchain/npm/bin/npm-cli.js /usr/local/bin/npm
ln -sf /opt/p17-toolchain/npm/bin/npx-cli.js /usr/local/bin/npx
test "$(npm --version)" = 11.19.1
LD_LIBRARY_PATH=/opt/p17-toolchain/openssl/usr/lib/x86_64-linux-gnu /opt/p17-toolchain/schema-engine --version
