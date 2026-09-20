import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { logger } from "./logger";

describe("structured logger security boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits structured JSON with level, event, timestamp and safe context", () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    logger.info("test_event", {
      correlationId:
        "11111111-1111-4111-8111-111111111111",
      state: "READY",
    });

    expect(output).toHaveBeenCalledTimes(1);

    const record = JSON.parse(
      String(output.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;

    expect(record.level).toBe("info");
    expect(record.event).toBe("test_event");
    expect(record.correlationId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(record.state).toBe("READY");
    expect(typeof record.timestamp).toBe(
      "string",
    );
  });

  it("redacts sensitive keys recursively and case-insensitively", () => {
    const output = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    logger.warn("security_test", {
      Authorization: "Bearer raw-secret",
      nested: {
        P11_BUYER_SESSION_SECRET:
          "session-secret",
        accessToken: "provider-token",
      },
    });

    const record = JSON.parse(
      String(output.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;

    expect(record.Authorization).toBe(
      "[REDACTED]",
    );

    expect(record.nested).toEqual({
      P11_BUYER_SESSION_SECRET:
        "[REDACTED]",
      accessToken: "[REDACTED]",
    });
  });

  it("redacts email fields", () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    logger.info("privacy_test", {
      email: "buyer@example.test",
      customerEmail:
        "customer@example.test",
    });

    const record = JSON.parse(
      String(output.mock.calls[0]?.[0]),
    ) as Record<string, unknown>;

    expect(record.email).toBe("[REDACTED]");
    expect(record.customerEmail).toBe(
      "[REDACTED]",
    );
  });

  it("redacts credential aliases, identifiers and nested array values", () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    logger.info("sensitive_alias_test", {
      adminSessionId: "admin-session-fixture",
      refresh_token: "refresh-fixture",
      P12_ADMIN_AUTH_SECRET: "admin-secret-fixture",
      META_CAPI_ACCESS_TOKEN: "meta-token-fixture",
      request: {
        cookies: "lessenc_buyer=raw-cookie-fixture",
        userAgent: "browser-fingerprint-fixture",
        ipAddress: "192.0.2.1",
      },
      attempts: [
        {
          providerOrderId: "provider-order-fixture",
          providerPaymentId: "provider-payment-fixture",
        },
      ],
      state: "REVIEW",
    });

    const serialized = String(output.mock.calls[0]?.[0]);
    for (const forbidden of [
      "admin-session-fixture",
      "refresh-fixture",
      "admin-secret-fixture",
      "meta-token-fixture",
      "raw-cookie-fixture",
      "browser-fingerprint-fixture",
      "192.0.2.1",
      "provider-order-fixture",
      "provider-payment-fixture",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }

    expect(serialized).toContain('"state":"REVIEW"');
  });

  it("does not serialize arbitrary Error messages", () => {
    const output = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logger.error("failure_test", {
      error: new Error(
        "DATABASE_URL=mysql://secret",
      ),
    });

    const serialized = String(
      output.mock.calls[0]?.[0],
    );

    expect(serialized).not.toContain(
      "mysql://secret",
    );

    const record = JSON.parse(
      serialized,
    ) as Record<string, unknown>;

    expect(record.error).toEqual({
      name: "Error",
    });
  });

  it("handles circular context without throwing", () => {
    const output = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    const circular: Record<string, unknown> =
      {};

    circular.self = circular;

    expect(() =>
      logger.info("circular_test", {
        circular,
      }),
    ).not.toThrow();

    const serialized = String(
      output.mock.calls[0]?.[0],
    );

    expect(serialized).toContain(
      "[CIRCULAR]",
    );
  });
});
