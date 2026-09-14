import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { Clock } from "../../shared/clock";
import { HmacBuyerSession } from "./hmac-buyer-session";

const SECRET = "p11-buyer-session-secret-32-bytes-minimum-value";

const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";

const ORDER_ID = "22222222-2222-4222-8222-222222222222";

const CREDENTIAL_ID = "33333333-3333-4333-8333-333333333333";

const NOW = Date.parse("2026-09-13T14:30:00.000Z");

class FixedClock implements Clock {
  constructor(private readonly value: number) {}

  now(): Date {
    return new Date(this.value);
  }
}

function service(now = NOW, secret = SECRET): HmacBuyerSession {
  return new HmacBuyerSession(secret, new FixedClock(now));
}

function subject() {
  return {
    customerId: CUSTOMER_ID,
    orderId: ORDER_ID,
    credentialId: CREDENTIAL_ID,
  };
}

function signPayload(payload: unknown, secret = SECRET): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  const signature = createHmac("sha256", secret).update(`v1.${body}`, "utf8").digest("base64url");

  return `v1.${body}.${signature}`;
}

describe("HmacBuyerSession", () => {
  it("issues and verifies a valid 24-hour buyer session", () => {
    const token = service().issue(subject());

    expect(service().verify(token)).toEqual({
      version: 1,
      purpose: "BUYER_SESSION",
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: CREDENTIAL_ID,
      issuedAt: NOW,
      expiresAt: NOW + 24 * 60 * 60 * 1000,
    });
  });

  it("uses an explicit v1 envelope and does not expose the signing secret", () => {
    const token = service().issue(subject());

    expect(token.startsWith("v1.")).toBe(true);

    expect(token.split(".")).toHaveLength(3);

    expect(token).not.toContain(SECRET);
  });

  it("rejects a secret shorter than 32 bytes", () => {
    expect(() => service(NOW, "too-short")).toThrow("P11_BUYER_SESSION_CONFIGURATION_UNAVAILABLE");
  });

  it.each([
    {
      customerId: "not-a-uuid",
      orderId: ORDER_ID,
      credentialId: CREDENTIAL_ID,
    },
    {
      customerId: CUSTOMER_ID,
      orderId: "not-a-uuid",
      credentialId: CREDENTIAL_ID,
    },
    {
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: "not-a-uuid",
    },
  ])("rejects an invalid buyer session subject: %j", (invalid) => {
    expect(() => service().issue(invalid)).toThrow("INVALID_BUYER_SESSION_SUBJECT");
  });

  it("rejects a malformed token", () => {
    expect(service().verify("anything")).toBeNull();

    expect(service().verify("v1.***.###")).toBeNull();

    expect(service().verify(null)).toBeNull();
  });

  it("rejects a modified signature", () => {
    const token = service().issue(subject());

    const [prefix, body, signature] = token.split(".");

    if (!prefix || !body || !signature) {
      throw new Error("session fixture malformed");
    }

    const replacement = signature.startsWith("A") ? "B" : "A";

    const tampered = `${replacement}${signature.slice(1)}`;

    expect(service().verify(`${prefix}.${body}.${tampered}`)).toBeNull();
  });

  it("rejects a payload modified without a valid signature", () => {
    const token = service().issue(subject());

    const [prefix, body, signature] = token.split(".");

    if (!prefix || !body || !signature) {
      throw new Error("session fixture malformed");
    }

    const decoded = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;

    decoded.orderId = "44444444-4444-4444-8444-444444444444";

    const modifiedBody = Buffer.from(JSON.stringify(decoded), "utf8").toString("base64url");

    expect(service().verify(`${prefix}.${modifiedBody}.${signature}`)).toBeNull();
  });

  it("rejects an expired buyer session", () => {
    const token = service().issue(subject());

    const afterExpiry = NOW + 24 * 60 * 60 * 1000;

    expect(service(afterExpiry).verify(token)).toBeNull();
  });

  it("accepts the session immediately before expiration", () => {
    const token = service().issue(subject());

    const beforeExpiry = NOW + 24 * 60 * 60 * 1000 - 1;

    expect(service(beforeExpiry).verify(token)).not.toBeNull();
  });

  it("rejects a session whose issued-at time is in the future", () => {
    const token = service().issue(subject());

    expect(service(NOW - 1).verify(token)).toBeNull();
  });

  it("rejects a correctly signed payload with extra claims", () => {
    const token = signPayload({
      version: 1,
      purpose: "BUYER_SESSION",
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: CREDENTIAL_ID,
      issuedAt: NOW,
      expiresAt: NOW + 24 * 60 * 60 * 1000,
      email: "should-not-exist@example.invalid",
    });

    expect(service().verify(token)).toBeNull();
  });

  it("rejects an unsupported signed purpose", () => {
    const token = signPayload({
      version: 1,
      purpose: "PAYMENT_CONTINUATION",
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: CREDENTIAL_ID,
      issuedAt: NOW,
      expiresAt: NOW + 24 * 60 * 60 * 1000,
    });

    expect(service().verify(token)).toBeNull();
  });

  it("rejects a signed payload with an invalid lifetime", () => {
    const token = signPayload({
      version: 1,
      purpose: "BUYER_SESSION",
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: CREDENTIAL_ID,
      issuedAt: NOW,
      expiresAt: NOW + 60 * 60 * 1000,
    });

    expect(service().verify(token)).toBeNull();
  });

  it("returns no secret or identity details when verification fails", () => {
    const result = service().verify("invalid-session");

    expect(result).toBeNull();

    expect(JSON.stringify(result)).not.toContain(SECRET);

    expect(JSON.stringify(result)).not.toContain(CUSTOMER_ID);
  });
});
