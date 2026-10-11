#!/bin/sh
set -eu

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

require_value() {
  actual_value="$1"
  expected_value="$2"
  error_code="$3"
  [ "$actual_value" = "$expected_value" ] || fail "$error_code"
}

package_version() {
  package_name="$1"
  node -e 'const path = process.argv[1]; process.stdout.write(require(`./node_modules/${path}/package.json`).version);' "$package_name"
}

require_package_version() {
  package_name="$1"
  expected_version="$2"
  error_code="$3"
  actual_version="$(package_version "$package_name" 2>/dev/null)" || fail "$error_code"
  require_value "$actual_version" "$expected_version" "$error_code"
}

command -v node >/dev/null 2>&1 || fail P17_CAPSULE_NODE_MISSING
command -v npm >/dev/null 2>&1 || fail P17_CAPSULE_NPM_MISSING
command -v id >/dev/null 2>&1 || fail P17_CAPSULE_ID_TOOL_MISSING

[ "$(id -u)" != "0" ] || fail P17_CAPSULE_ROOT_USER_FORBIDDEN
require_value "$(id -u)" "17017" P17_CAPSULE_UID_INVALID
require_value "$(id -g)" "17017" P17_CAPSULE_GID_INVALID
require_value "$(id -un)" "p17perf" P17_CAPSULE_USER_INVALID

require_value "$(node --version)" "${P17_EXPECTED_NODE_VERSION:-}" P17_CAPSULE_NODE_VERSION_INVALID
require_value "$(npm --version)" "${P17_EXPECTED_NPM_VERSION:-}" P17_CAPSULE_NPM_VERSION_INVALID
require_package_version next "${P17_EXPECTED_NEXT_VERSION:-}" P17_CAPSULE_NEXT_VERSION_INVALID
require_package_version playwright-core "${P17_EXPECTED_PLAYWRIGHT_VERSION:-}" P17_CAPSULE_PLAYWRIGHT_VERSION_INVALID
require_package_version @playwright/test "${P17_EXPECTED_PLAYWRIGHT_VERSION:-}" P17_CAPSULE_PLAYWRIGHT_TEST_VERSION_INVALID
require_package_version prisma "${P17_EXPECTED_PRISMA_VERSION:-}" P17_CAPSULE_PRISMA_CLI_VERSION_INVALID
require_package_version @prisma/client "${P17_EXPECTED_PRISMA_VERSION:-}" P17_CAPSULE_PRISMA_CLIENT_VERSION_INVALID
require_package_version sharp "${P17_EXPECTED_SHARP_VERSION:-}" P17_CAPSULE_SHARP_VERSION_INVALID
require_package_version source-map-js "${P17_EXPECTED_SOURCE_MAP_JS_VERSION:-}" P17_CAPSULE_SOURCE_MAP_JS_VERSION_INVALID
require_package_version @next/swc-linux-x64-gnu "${P17_EXPECTED_SWC_VERSION:-}" P17_CAPSULE_SWC_LINUX_VERSION_INVALID

chromium_path="$(
  node -e 'const { chromium } = require("playwright-core"); process.stdout.write(chromium.executablePath());'
)" || fail P17_CAPSULE_CHROMIUM_PATH_UNAVAILABLE

case "$chromium_path" in
  "${PLAYWRIGHT_BROWSERS_PATH:-/ms-playwright}/chromium-${P17_EXPECTED_CHROMIUM_REVISION:-}"/*) ;;
  *) fail P17_CAPSULE_CHROMIUM_REVISION_INVALID ;;
esac

[ -x "$chromium_path" ] || fail P17_CAPSULE_CHROMIUM_MISSING
chromium_version="$($chromium_path --version 2>/dev/null)" || fail P17_CAPSULE_CHROMIUM_VERSION_UNAVAILABLE
case "$chromium_version" in
  *"${P17_EXPECTED_CHROMIUM_VERSION:-}"*) ;;
  *) fail P17_CAPSULE_CHROMIUM_VERSION_INVALID ;;
esac

require_value "${APP_ENV:-}" local P17_CAPSULE_APP_ENV_INVALID
require_value "${NODE_ENV:-}" production P17_CAPSULE_NODE_ENV_INVALID
require_value "${P17_TARGET:-}" local P17_CAPSULE_TARGET_INVALID
require_value "${APP_URL:-}" http://127.0.0.1:3100 P17_CAPSULE_APP_URL_INVALID
require_value "${PRIVATE_STORAGE_DRIVER:-}" local-filesystem P17_CAPSULE_STORAGE_DRIVER_INVALID
require_value "${NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY:-}" p17_perf_public_key_synthetic_only P17_CAPSULE_PUBLIC_KEY_NOT_SYNTHETIC

case "${P17_PERF_RUN_ID:-}" in
  p17-perf-[a-z0-9][a-z0-9._-][a-z0-9._-][a-z0-9._-][a-z0-9._-][a-z0-9._-][a-z0-9._-][a-z0-9._-]*) ;;
  *) fail P17_CAPSULE_RUN_ID_INVALID ;;
esac

case "${PRIVATE_FILE_STORAGE_PATH:-}" in
  /workspace/tmp/p17-performance-storage | /workspace/tmp/p17-performance-storage/*) ;;
  *) fail P17_CAPSULE_STORAGE_PATH_INVALID ;;
esac
[ -d "${PRIVATE_FILE_STORAGE_PATH:-}" ] || fail P17_CAPSULE_STORAGE_PATH_MISSING
[ -w "${PRIVATE_FILE_STORAGE_PATH:-}" ] || fail P17_CAPSULE_STORAGE_PATH_NOT_WRITABLE

case "${DATABASE_URL:-}" in
  mysql://lessenc_p17_perf:p17_perf_*@127.0.0.1:3307/lessenc_p17_perf_test) ;;
  *) fail P17_CAPSULE_DATABASE_URL_INVALID ;;
esac

require_value "${DB_RUNTIME_URL:-}" "${DATABASE_URL:-}" P17_CAPSULE_DB_RUNTIME_URL_INVALID
require_value "${P17_PERF_DB_RUNTIME_URL:-}" "${DATABASE_URL:-}" P17_CAPSULE_PERF_DB_RUNTIME_URL_INVALID

if env | sed 's/=.*//' | grep -Eq '^(ALL_PROXY|GOOGLE_ADS_CONVERSION_ID|GOOGLE_ADS_CONVERSION_LABEL|GTM_CONTAINER_ID|HTTP_PROXY|HTTPS_PROXY|MERCADOPAGO_ACCESS_TOKEN|META_CAPI_ACCESS_TOKEN|META_PIXEL_ID|P16_PRIVATE_STORAGE_PROVIDER|P17_ALLOW_HOSTED_READ_ONLY|P17_BASE_URL|PRIVATE_STORAGE_HEALTHCHECK_KEY|PRIVATE_STORAGE_S3_ACCESS_KEY_ID|PRIVATE_STORAGE_S3_BUCKET|PRIVATE_STORAGE_S3_ENDPOINT|PRIVATE_STORAGE_S3_REGION|PRIVATE_STORAGE_S3_SECRET_ACCESS_KEY)$'; then
  fail P17_CAPSULE_EXTERNAL_ENVIRONMENT_PRESENT
fi

node /workspace/scripts/p17-capsule-network.mjs

observed_source_tree="$(tr -d '\r\n' < /workspace/.p17-source-tree.sha256)" || fail P17_CAPSULE_SOURCE_TREE_MISSING
printf '%s' "$observed_source_tree" | grep -Eq '^[0-9a-f]{64}$' || fail P17_CAPSULE_SOURCE_TREE_INVALID

case "${1:-validate}" in
  validate)
    require_value "${P17_PERF_MODE:-}" infrastructure-only P17_CAPSULE_MODE_INVALID
    printf '%s\n' P17_CAPSULE_RUNTIME_PREREQUISITES_VALIDATED
    printf '%s\n' P17_CAPSULE_STATIC_ISOLATION_VALIDATED
    ;;
  run)
    require_value "${P17_PERF_MODE:-}" acceptance-local P17_CAPSULE_MODE_INVALID
    require_value "${P17_PERF_EXECUTION_AUTHORITY:-}" LES-P17-AUTONOMOUS-CLOSEOUT-R01 P17_CAPSULE_EXECUTION_AUTHORITY_INVALID
    require_value "${P17_SOURCE_TREE_SHA256:-}" "$observed_source_tree" P17_CAPSULE_SOURCE_TREE_MISMATCH
    printf '%s' "${P17_PERF_COMMIT:-}" | grep -Eq '^[0-9a-f]{40}$' || fail P17_CAPSULE_COMMIT_INVALID
    exec node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
      /workspace/scripts/p17-performance-controller.mjs run-local-acceptance
    ;;
  collect | server)
    fail P17_PERFORMANCE_COMMAND_NOT_AUTHORIZED
    ;;
  *)
    fail P17_CAPSULE_COMMAND_INVALID
    ;;
esac
