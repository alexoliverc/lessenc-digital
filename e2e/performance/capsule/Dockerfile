ARG P17_NODE_IMAGE="node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20"
ARG P17_PLAYWRIGHT_IMAGE="mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27"

FROM ${P17_NODE_IMAGE} AS node-runtime

COPY e2e/performance/capsule/supply-chain.json e2e/performance/capsule/bootstrap-toolchain.sh scripts/p17-toolchain-verify.mjs /opt/p17-bootstrap/
COPY e2e/performance/capsule/offline/artifacts/npm-11.19.1.tgz e2e/performance/capsule/offline/artifacts/libssl3_3.0.22-1~deb12u1_amd64.deb e2e/performance/capsule/offline/artifacts/schema-engine.gz /opt/p17-bootstrap/artifacts/
RUN --network=none /bin/sh /opt/p17-bootstrap/bootstrap-toolchain.sh

FROM node-runtime AS app-build

ARG P17_PERF_UID=17017
ARG P17_PERF_GID=17017
ARG P17_SOURCE_COMMIT=UNVERIFIED

ENV APP_ENV=local \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_OFFLINE=true \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=p17_perf_public_key_synthetic_only \
    PRISMA_SCHEMA_ENGINE_BINARY=/opt/p17-toolchain/schema-engine \
    HOME=/home/p17perf \
    P17_OFFLINE_NPM_CACHE=/opt/p17-offline/npm-cache/npm-11.19.1/node-24.21.0/linux-amd64-glibc/E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720/cache \
    P17_OFFLINE_NPM_MANIFEST=/opt/p17-offline/manifests/npm-11.19.1-node-24.21.0-linux-amd64-glibc-E93A35F25C59.manifest.json \
    P17_OFFLINE_NPM_INVENTORY=/opt/p17-offline/manifests/npm-11.19.1-node-24.21.0-linux-amd64-glibc-E93A35F25C59.files.sha512 \
    P17_EXPECTED_NPM_VERSION=11.19.1 \
    P17_EXPECTED_PACKAGE_LOCK_SHA256=E93A35F25C59CADF6BEA860759B447CC2F86DEC16CA562B0182BB5AC02902720

WORKDIR /workspace

RUN --network=none groupadd --gid "${P17_PERF_GID}" p17perf \
    && useradd --uid "${P17_PERF_UID}" --gid "${P17_PERF_GID}" --create-home --shell /usr/sbin/nologin p17perf \
    && install -d -o p17perf -g p17perf -m 0700 /opt/p17-offline /workspace

COPY --chown=p17perf:p17perf package.json package-lock.json ./
COPY --chown=p17perf:p17perf next-env.d.ts next.config.ts tsconfig.json prisma.config.ts ./
COPY --chown=p17perf:p17perf prisma/schema.prisma ./prisma/schema.prisma
COPY --chown=p17perf:p17perf scripts/lib/p16-prisma-migration-tls.mjs ./scripts/lib/p16-prisma-migration-tls.mjs
COPY --chown=p17perf:p17perf scripts/ ./scripts/
COPY --chown=p17perf:p17perf src/ ./src/
COPY --chown=p17perf:p17perf e2e/performance/capsule/build-app.sh ./e2e/performance/capsule/build-app.sh
COPY --chown=p17perf:p17perf e2e/performance/capsule/contract.json ./e2e/performance/capsule/contract.json
COPY --chown=p17perf:p17perf scripts/p17-npm-cache-verify.mjs ./scripts/p17-npm-cache-verify.mjs
COPY --chown=p17perf:p17perf e2e/performance/capsule/offline/ /opt/p17-offline/

USER p17perf

RUN --network=none node -e 'const value = process.argv[1]; if (value !== "UNVERIFIED" && !/^[0-9a-f]{40}$/.test(value)) process.exit(1);' "${P17_SOURCE_COMMIT}" \
    && printf '%s\n' "${P17_SOURCE_COMMIT}" > /workspace/.p17-declared-commit \
    && chmod 0444 /workspace/.p17-declared-commit

RUN --network=none /bin/sh ./e2e/performance/capsule/build-app.sh

FROM ${P17_PLAYWRIGHT_IMAGE} AS app-runtime

ARG P17_PERF_UID=17017
ARG P17_PERF_GID=17017
ARG P17_SOURCE_TREE_SHA256=UNVERIFIED

ENV APP_ENV=local \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=p17_perf_public_key_synthetic_only \
    HOME=/home/p17perf \
    PRISMA_SCHEMA_ENGINE_BINARY=/opt/p17-toolchain/schema-engine \
    LD_LIBRARY_PATH=/opt/p17-toolchain/openssl/usr/lib/x86_64-linux-gnu \
    PATH=/opt/node24/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    P17_EXPECTED_NODE_VERSION=v24.21.0 \
    P17_EXPECTED_NPM_VERSION=11.19.1 \
    P17_EXPECTED_NEXT_VERSION=16.3.8 \
    P17_EXPECTED_PLAYWRIGHT_VERSION=1.63.0 \
    P17_EXPECTED_PRISMA_VERSION=7.10.0 \
    P17_EXPECTED_SHARP_VERSION=0.35.5 \
    P17_EXPECTED_SOURCE_MAP_JS_VERSION=1.2.2 \
    P17_EXPECTED_SWC_VERSION=16.3.8 \
    P17_EXPECTED_CHROMIUM_REVISION=1243 \
    P17_EXPECTED_CHROMIUM_VERSION=153.0.8010.12

WORKDIR /workspace

COPY --from=node-runtime /usr/local/ /opt/node24/
COPY --from=node-runtime /opt/p17-toolchain/ /opt/p17-toolchain/

RUN --network=none groupadd --gid "${P17_PERF_GID}" p17perf \
    && useradd --uid "${P17_PERF_UID}" --gid "${P17_PERF_GID}" --create-home --shell /usr/sbin/nologin p17perf \
    && install -d -o p17perf -g p17perf -m 0700 \
      /home/p17perf/.cache \
      /workspace/output/p17-performance \
      /workspace/tmp/p17-performance-storage

COPY --from=app-build --chown=p17perf:p17perf /workspace/ /workspace/
COPY --chown=p17perf:p17perf e2e/performance/capsule/entrypoint.sh /workspace/e2e/performance/capsule/entrypoint.sh
COPY --chown=p17perf:p17perf scripts/p17-capsule-network.mjs /workspace/scripts/p17-capsule-network.mjs
COPY --chown=p17perf:p17perf scripts/p17-runtime-smoke.mjs scripts/p17-navigation-diagnostics.mjs /workspace/scripts/
COPY --chown=p17perf:p17perf vitest.config.mts vitest.integration.config.mjs playwright.config.ts /workspace/
COPY --chown=p17perf:p17perf scripts/p06-db-guard.mjs scripts/p17-e2e-server.mjs /workspace/scripts/
COPY --chown=p17perf:p17perf prisma/migrations/ /workspace/prisma/migrations/
COPY --chown=p17perf:p17perf e2e/*.spec.ts /workspace/e2e/
COPY --chown=p17perf:p17perf e2e/helpers/ /workspace/e2e/helpers/
COPY --chown=p17perf:p17perf playwright.performance.config.ts vitest.performance.config.mts /workspace/
COPY --chown=p17perf:p17perf e2e/performance/helpers/ /workspace/e2e/performance/helpers/
COPY --chown=p17perf:p17perf e2e/performance/fixtures/ /workspace/e2e/performance/fixtures/
COPY --chown=p17perf:p17perf e2e/performance/*.perf.spec.ts /workspace/e2e/performance/
# Next regenerates this declaration during build. Restore the reviewed build-context bytes so the
# final source manifest binds the exact declared input rather than an incidental generated variant.
COPY --chown=p17perf:p17perf next-env.d.ts /workspace/next-env.d.ts

RUN --network=none /opt/node24/bin/node /workspace/scripts/p17-source-provenance.mjs write /workspace /workspace/.p17-source-tree.sha256 \
    && /opt/node24/bin/node -e 'const fs = require("node:fs"); const expected = process.argv[1]; const observed = fs.readFileSync("/workspace/.p17-source-tree.sha256", "utf8").trim(); if (expected !== "UNVERIFIED" && (!/^[0-9a-f]{64}$/.test(expected) || observed !== expected)) process.exit(1);' "${P17_SOURCE_TREE_SHA256}" \
    && chmod 0444 /workspace/.p17-source-tree.sha256 \
    && chmod 0550 /workspace/e2e/performance/capsule/entrypoint.sh \
    && find /workspace -perm /022 -exec chmod go-w {} + \
    && chmod 0700 /home/p17perf/.cache /workspace/output/p17-performance /workspace/tmp/p17-performance-storage

USER p17perf

ENTRYPOINT ["/bin/sh", "/workspace/e2e/performance/capsule/entrypoint.sh"]
CMD ["validate"]
