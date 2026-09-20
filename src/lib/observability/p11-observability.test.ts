import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createP11CorrelationId,
  p11Observability,
  type P11ObservabilityContext,
} from "./p11-observability";

const correlationId = "11111111-1111-4111-8111-111111111111";

describe("P11 observability contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a server-side UUID correlation id", () => {
    expect(createP11CorrelationId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
  });

  it("emits only allowlisted P11 context fields", () => {
    const output = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const unsafeRuntimeContext = {
      correlationId,
      surface: "RATE_LIMIT",
      scope: "DOWNLOAD_CREDENTIAL",
      outcome: "DENIED",
      failureCode: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 30,
      windowSeconds: 60,
      limit: 30,
      rawCredential: "lba_raw-secret",
      token: "session-token",
      email: "buyer@example.test",
      orderId: "order-sensitive-id",
    } as unknown as P11ObservabilityContext;

    p11Observability.warn("buyer_access_rate_limited", unsafeRuntimeContext);

    const serialized = String(output.mock.calls[0]?.[0]);

    expect(serialized).not.toContain("lba_raw-secret");
    expect(serialized).not.toContain("session-token");
    expect(serialized).not.toContain("buyer@example.test");
    expect(serialized).not.toContain("order-sensitive-id");

    const record = JSON.parse(serialized) as Record<string, unknown>;

    expect(record).toMatchObject({
      event: "buyer_access_rate_limited",
      correlationId,
      surface: "RATE_LIMIT",
      scope: "DOWNLOAD_CREDENTIAL",
      outcome: "DENIED",
      failureCode: "RATE_LIMIT_EXCEEDED",
      retryAfterSeconds: 30,
      windowSeconds: 60,
      limit: 30,
    });
  });

  it("routes error events through the error logger", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => undefined);

    p11Observability.error("delivery_audit_unavailable", {
      correlationId,
      surface: "DELIVERY_AUDIT",
      outcome: "FAILED",
      failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
    });

    expect(output).toHaveBeenCalledTimes(1);

    const record = JSON.parse(String(output.mock.calls[0]?.[0])) as Record<string, unknown>;

    expect(record.level).toBe("error");
    expect(record.event).toBe("delivery_audit_unavailable");
  });

  it("rejects free-form failure messages", () => {
    expect(() =>
      p11Observability.error("private_storage_failure", {
        correlationId,
        surface: "PRIVATE_STORAGE",
        outcome: "FAILED",
        failureCode: "database at C:\\private\\secret",
      }),
    ).toThrow("INVALID_P11_OBSERVABILITY_FAILURE_CODE");
  });

  it("rejects runtime surfaces outside the frozen allowlist", () => {
    const unsafeContext = {
      correlationId,
      surface: "CUSTOMER_EMAIL",
    } as unknown as P11ObservabilityContext;

    expect(() => p11Observability.info("buyer_access_invalid", unsafeContext)).toThrow(
      "INVALID_P11_OBSERVABILITY_SURFACE",
    );
  });
});
