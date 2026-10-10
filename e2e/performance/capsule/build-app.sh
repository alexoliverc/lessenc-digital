#!/bin/sh
set -eu

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

[ "${APP_ENV:-}" = "local" ] || fail P17_CAPSULE_BUILD_APP_ENV_INVALID
[ "${NODE_ENV:-}" = "production" ] || fail P17_CAPSULE_BUILD_NODE_ENV_INVALID
[ "${NPM_CONFIG_OFFLINE:-}" = "true" ] || fail P17_CAPSULE_BUILD_NPM_OFFLINE_REQUIRED
[ "${PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD:-}" = "1" ] || fail P17_CAPSULE_BUILD_BROWSER_DOWNLOAD_NOT_BLOCKED
[ "$(id -u)" != "0" ] || fail P17_CAPSULE_BUILD_ROOT_USER_FORBIDDEN

if env | sed 's/=.*//' | grep -Eq '^(ALL_PROXY|GOOGLE_ADS_CONVERSION_ID|GOOGLE_ADS_CONVERSION_LABEL|GTM_CONTAINER_ID|HTTP_PROXY|HTTPS_PROXY|MERCADOPAGO_ACCESS_TOKEN|META_CAPI_ACCESS_TOKEN|META_PIXEL_ID|P16_PRIVATE_STORAGE_PROVIDER|P17_ALLOW_HOSTED_READ_ONLY|P17_BASE_URL|PRIVATE_STORAGE_HEALTHCHECK_KEY|PRIVATE_STORAGE_S3_ACCESS_KEY_ID|PRIVATE_STORAGE_S3_BUCKET|PRIVATE_STORAGE_S3_ENDPOINT|PRIVATE_STORAGE_S3_REGION|PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY)$'; then
  fail P17_CAPSULE_BUILD_EXTERNAL_ENVIRONMENT_PRESENT
fi

actual_lock_hash="$(node -e 'const fs = require("node:fs"); const crypto = require("node:crypto"); process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync("package-lock.json")).digest("hex").toUpperCase());')"
[ "$actual_lock_hash" = "${P17_EXPECTED_PACKAGE_LOCK_SHA256:-}" ] || fail P17_CAPSULE_PACKAGE_LOCK_HASH_INVALID
[ "$(npm --version)" = "${P17_EXPECTED_NPM_VERSION:-}" ] || fail P17_CAPSULE_NPM_VERSION_INVALID

offline_cache="${P17_OFFLINE_NPM_CACHE:-}"
[ -n "$offline_cache" ] || fail P17_CAPSULE_NPM_CACHE_PATH_MISSING
[ -d "$offline_cache/_cacache/content-v2" ] || fail P17_CAPSULE_NPM_CACHE_NOT_MATERIALIZED
[ -d "$offline_cache/_cacache/index-v5" ] || fail P17_CAPSULE_NPM_CACHE_INDEX_NOT_MATERIALIZED

offline_manifest="${P17_OFFLINE_NPM_MANIFEST:-}"
offline_inventory="${P17_OFFLINE_NPM_INVENTORY:-}"
[ -f "$offline_manifest" ] || fail P17_CAPSULE_NPM_CACHE_MANIFEST_MISSING
[ -f "$offline_inventory" ] || fail P17_CAPSULE_NPM_CACHE_INVENTORY_MISSING

node ./scripts/p17-npm-cache-verify.mjs verify-cache \
  --lockfile package-lock.json \
  --contract e2e/performance/capsule/contract.json \
  --cache-root "$offline_cache" \
  --manifest "$offline_manifest" \
  --inventory "$offline_inventory"

npm ci \
  --offline \
  --ignore-scripts \
  --include=dev \
  --no-audit \
  --no-fund \
  --cache "$offline_cache"

node <<'NODE'
const expected = new Map([
  ["next", "16.3.8"],
  ["playwright", "1.63.0"],
  ["playwright-core", "1.63.0"],
  ["@playwright/test", "1.63.0"],
  ["prisma", "7.10.0"],
  ["@prisma/client", "7.10.0"],
  ["@prisma/adapter-mariadb", "7.10.0"],
  ["@next/swc-linux-x64-gnu", "16.3.8"],
]);

for (const [name, version] of expected) {
  const actual = require(`./node_modules/${name}/package.json`).version;
  if (actual !== version) throw new Error("P17_CAPSULE_LINUX_DEPENDENCY_VERSION_INVALID");
}
NODE

[ -x "${PRISMA_SCHEMA_ENGINE_BINARY:-}" ] || fail P17_CAPSULE_SCHEMA_ENGINE_MISSING
"$PRISMA_SCHEMA_ENGINE_BINARY" --version | grep -F '0edf323efd1d98336f3f0a68684b56f689b900d3' >/dev/null || fail P17_CAPSULE_SCHEMA_ENGINE_VERSION_INVALID
node -e 'require("@prisma/get-platform").getBinaryTargetForCurrentPlatform().then(t => { if(t !== "debian-openssl-3.0.x") process.exit(1); console.log("P17_PRISMA_TARGET=" + t); });'

APP_ENV=local DATABASE_URL='mysql://lessenc_p17_perf:p17_perf_build_synthetic_only@127.0.0.1:3307/lessenc_p17_perf_test' \
  ./node_modules/.bin/prisma generate

APP_ENV=local NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
  DATABASE_URL='mysql://lessenc_p17_perf:p17_perf_build_synthetic_only@127.0.0.1:3307/lessenc_p17_perf_test' \
  ./node_modules/.bin/next build

[ -f .next/BUILD_ID ] || fail P17_CAPSULE_NEXT_BUILD_MISSING
