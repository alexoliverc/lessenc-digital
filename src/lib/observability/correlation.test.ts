import { describe, expect, it } from "vitest";

import {
  CORRELATION_RESPONSE_HEADER,
  createCorrelationId,
  INTERNAL_CORRELATION_REQUEST_HEADER,
  normalizeCorrelationId,
  resolveRequestCorrelationId,
  setCorrelationResponseHeader,
} from "./correlation";

const correlationId = "11111111-1111-4111-8111-111111111111";

describe("P15 correlation contract", () => {
  it("generates a server-side UUID and normalizes only canonical identifiers", () => {
    expect(createCorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(normalizeCorrelationId(correlationId.toUpperCase())).toBe(correlationId);
    expect(normalizeCorrelationId("attacker-controlled-value")).toBeNull();
  });

  it("uses only the internal request header and ignores the public response header", () => {
    const internal = new Headers({
      [INTERNAL_CORRELATION_REQUEST_HEADER]: correlationId,
      [CORRELATION_RESPONSE_HEADER]: "22222222-2222-4222-8222-222222222222",
    });

    expect(resolveRequestCorrelationId(internal)).toBe(correlationId);

    const publicOnly = new Headers({
      [CORRELATION_RESPONSE_HEADER]: correlationId,
    });

    expect(resolveRequestCorrelationId(publicOnly)).not.toBe(correlationId);
  });

  it("sets a sanitized response header and rejects invalid values", () => {
    const headers = new Headers();

    setCorrelationResponseHeader(headers, correlationId);
    expect(headers.get(CORRELATION_RESPONSE_HEADER)).toBe(correlationId);

    expect(() => setCorrelationResponseHeader(headers, "not-a-correlation-id")).toThrow(
      "INVALID_CORRELATION_ID",
    );
  });
});
