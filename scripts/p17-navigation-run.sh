#!/bin/sh
set -eu

node scripts/p17-e2e-server.mjs >/tmp/p17-navigation-server.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM

node <<'NODE'
let ready = false;
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const response = await fetch("http://127.0.0.1:3100/api/health");
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready) throw new Error("P17_NAVIGATION_SERVER_NOT_READY");
NODE

node scripts/p17-navigation-diagnostics.mjs
