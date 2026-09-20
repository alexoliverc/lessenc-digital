#!/usr/bin/env node
/* global fetch */
import process from "node:process";
import { URL } from "node:url";

const baseUrl = process.env.P16_SMOKE_BASE_URL;
const readinessToken = process.env.P16_READINESS_TOKEN;

if (!baseUrl || !readinessToken || readinessToken.length < 32) {
  process.stderr.write("P16 hosted smoke requires P16_SMOKE_BASE_URL and P16_READINESS_TOKEN.\n");
  process.exitCode = 1;
} else {
  const origin = new URL(baseUrl);
  if (origin.protocol !== "https:") throw new Error("P16_SMOKE_HTTPS_REQUIRED");

  const health = await fetch(new URL("/api/health", origin), { redirect: "error" });
  const healthBody = await health.text();
  if (health.status !== 200 || healthBody !== '{"status":"ok"}') {
    throw new Error("P16_HEALTH_SMOKE_FAILED");
  }

  const unauthorized = await fetch(new URL("/api/readiness", origin), { redirect: "error" });
  if (unauthorized.status !== 404) throw new Error("P16_READINESS_PUBLIC_BOUNDARY_FAILED");

  const readiness = await fetch(new URL("/api/readiness", origin), {
    headers: { authorization: `Bearer ${readinessToken}` },
    redirect: "error",
  });
  const readinessBody = await readiness.text();
  if (readiness.status !== 200 || readinessBody !== '{"status":"ready"}') {
    throw new Error("P16_READINESS_SMOKE_FAILED");
  }
  if (readiness.headers.get("cache-control") !== "no-store") {
    throw new Error("P16_READINESS_CACHE_POLICY_FAILED");
  }

  const securityHeaders = [
    "content-security-policy",
    "strict-transport-security",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "x-frame-options",
  ];
  const missing = securityHeaders.filter((name) => !health.headers.has(name));
  if (missing.length > 0) throw new Error(`P16_SECURITY_HEADERS_MISSING:${missing.join(",")}`);

  process.stdout.write("P16 hosted liveness, protected readiness and header smoke passed.\n");
}
