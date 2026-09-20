import { randomUUID } from "node:crypto";

import { CORRELATION_RESPONSE_HEADER, INTERNAL_CORRELATION_REQUEST_HEADER } from "./contracts";

export { CORRELATION_RESPONSE_HEADER, INTERNAL_CORRELATION_REQUEST_HEADER } from "./contracts";

const CORRELATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function createCorrelationId(): string {
  return randomUUID();
}

export function normalizeCorrelationId(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !CORRELATION_ID_PATTERN.test(value)) {
    return null;
  }

  return value.toLowerCase();
}

export function resolveRequestCorrelationId(headers: Headers): string {
  return (
    normalizeCorrelationId(headers.get(INTERNAL_CORRELATION_REQUEST_HEADER)) ??
    createCorrelationId()
  );
}

export function setCorrelationResponseHeader(headers: Headers, correlationId: string): void {
  const normalized = normalizeCorrelationId(correlationId);

  if (normalized === null) {
    throw new Error("INVALID_CORRELATION_ID");
  }

  headers.set(CORRELATION_RESPONSE_HEADER, normalized);
}
