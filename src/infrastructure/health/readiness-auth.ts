import { createHash, timingSafeEqual } from "node:crypto";

import { parseP16ReadinessEnv } from "@/lib/config/env-schema";

const BEARER_PATTERN = /^Bearer ([^\s]+)$/u;

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/** Compares fixed-length digests so malformed input cannot create a length oracle. */
export function isReadinessRequestAuthorized(
  request: Request,
  expectedToken = parseP16ReadinessEnv({
    P16_READINESS_TOKEN: process.env.P16_READINESS_TOKEN,
  }).P16_READINESS_TOKEN,
): boolean {
  const authorization = request.headers.get("authorization");
  const candidate = authorization?.match(BEARER_PATTERN)?.[1];

  if (!candidate) return false;

  return timingSafeEqual(digest(candidate), digest(expectedToken));
}
