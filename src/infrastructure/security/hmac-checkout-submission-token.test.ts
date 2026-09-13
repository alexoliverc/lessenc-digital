import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { HmacCheckoutSubmissionTokenService } from "./hmac-checkout-submission-token";

const secret = "p09-test-secret-32-bytes-minimum-value";

const submissionId = "123e4567-e89b-12d3-a456-426614174000";

const issuedAt = "2026-09-13T01:00:00.000Z";

const presentedAmountMinor = 2990;

const presentedCurrency = "BRL";

function createService(signingSecret = secret): HmacCheckoutSubmissionTokenService {
  return new HmacCheckoutSubmissionTokenService(signingSecret);
}

function validTokenInput() {
  return {
    submissionId,
    issuedAt,
    presentedAmountMinor,
    presentedCurrency,
  };
}

function signPayload(payload: unknown, signingSecret = secret): string {
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString("base64url");

  const signature = createHmac("sha256", signingSecret)
    .update(payloadSegment, "utf8")
    .digest("base64url");

  return `${payloadSegment}.${signature}`;
}

describe("HmacCheckoutSubmissionTokenService", () => {
  it("issues and verifies a valid token", () => {
    const service = createService();

    const issued = service.issue(validTokenInput());

    expect(issued.ok).toBe(true);

    if (!issued.ok) {
      throw new Error("token fixture was not issued");
    }

    expect(service.verify(issued.token)).toEqual({
      ok: true,
      value: {
        submissionId,
        issuedAt,
        presentedAmountMinor,
        presentedCurrency,
      },
    });
  });

  it("is deterministic for the same payload and secret", () => {
    const service = createService();

    const first = service.issue(validTokenInput());

    const second = service.issue(validTokenInput());

    expect(first).toEqual(second);
  });

  it("rejects secrets shorter than 32 bytes", () => {
    const service = createService("too-short");

    expect(service.issue(validTokenInput())).toEqual({
      ok: false,
      reason: "INVALID_SECRET",
    });

    expect(service.verify("anything")).toEqual({
      ok: false,
      reason: "INVALID_SECRET",
    });
  });

  it("rejects invalid submission UUIDs at issuance", () => {
    const service = createService();

    expect(
      service.issue({
        ...validTokenInput(),
        submissionId: "not-a-uuid",
      }),
    ).toEqual({
      ok: false,
      reason: "INVALID_SUBMISSION_ID",
    });
  });

  it("rejects invalid issued-at instants at issuance", () => {
    const service = createService();

    expect(
      service.issue({
        ...validTokenInput(),
        issuedAt: "2026-09-13",
      }),
    ).toEqual({
      ok: false,
      reason: "INVALID_ISSUED_AT",
    });
  });

  it("rejects invalid presented amounts at issuance", () => {
    const service = createService();

    expect(
      service.issue({
        ...validTokenInput(),
        presentedAmountMinor: 0,
      }),
    ).toEqual({
      ok: false,
      reason: "INVALID_PRESENTED_AMOUNT",
    });
  });

  it("rejects unsupported presented currencies at issuance", () => {
    const service = createService();

    expect(
      service.issue({
        ...validTokenInput(),
        presentedCurrency: "USD",
      }),
    ).toEqual({
      ok: false,
      reason: "INVALID_PRESENTED_CURRENCY",
    });
  });

  it("rejects a tampered presented amount", () => {
    const service = createService();
    const issued = service.issue(validTokenInput());

    if (!issued.ok) {
      throw new Error("token fixture was not issued");
    }

    const [, signatureSegment] = issued.token.split(".");

    if (!signatureSegment) {
      throw new Error("issued token fixture is malformed");
    }

    const modifiedPayload = Buffer.from(
      JSON.stringify({
        v: 2,
        submissionId,
        issuedAt,
        presentedAmountMinor: 3990,
        presentedCurrency,
      }),
    ).toString("base64url");

    expect(service.verify(`${modifiedPayload}.${signatureSegment}`)).toEqual({
      ok: false,
      reason: "INVALID_SIGNATURE",
    });
  });

  it("rejects a tampered presented currency", () => {
    const service = createService();
    const issued = service.issue(validTokenInput());

    if (!issued.ok) {
      throw new Error("token fixture was not issued");
    }

    const [, signatureSegment] = issued.token.split(".");

    if (!signatureSegment) {
      throw new Error("issued token fixture is malformed");
    }

    const modifiedPayload = Buffer.from(
      JSON.stringify({
        v: 2,
        submissionId,
        issuedAt,
        presentedAmountMinor,
        presentedCurrency: "USD",
      }),
    ).toString("base64url");

    expect(service.verify(`${modifiedPayload}.${signatureSegment}`)).toEqual({
      ok: false,
      reason: "INVALID_SIGNATURE",
    });
  });
  it("rejects a modified signature", () => {
    const service = createService();

    const issued = service.issue(validTokenInput());

    if (!issued.ok) {
      throw new Error("token fixture was not issued");
    }

    const [payloadSegment, signatureSegment] = issued.token.split(".");

    if (!payloadSegment || !signatureSegment) {
      throw new Error("issued token fixture is malformed");
    }

    const replacement = signatureSegment.startsWith("A") ? "B" : "A";

    const tamperedSignature = `${replacement}${signatureSegment.slice(1)}`;

    expect(service.verify(`${payloadSegment}.${tamperedSignature}`)).toEqual({
      ok: false,
      reason: "INVALID_SIGNATURE",
    });
  });

  it("rejects modified payload content", () => {
    const service = createService();

    const issued = service.issue(validTokenInput());

    if (!issued.ok) {
      throw new Error("token fixture was not issued");
    }

    const [, signatureSegment] = issued.token.split(".");

    if (!signatureSegment) {
      throw new Error("issued token fixture is malformed");
    }

    const modifiedPayload = Buffer.from(
      JSON.stringify({
        v: 2,
        submissionId: "123e4567-e89b-12d3-a456-426614174001",
        issuedAt,
        presentedAmountMinor,
        presentedCurrency,
      }),
    ).toString("base64url");

    expect(service.verify(`${modifiedPayload}.${signatureSegment}`)).toEqual({
      ok: false,
      reason: "INVALID_SIGNATURE",
    });
  });

  it("rejects malformed token encoding", () => {
    const service = createService();

    expect(service.verify("***.###")).toEqual({
      ok: false,
      reason: "MALFORMED_TOKEN",
    });

    expect(service.verify("only-one-segment")).toEqual({
      ok: false,
      reason: "MALFORMED_TOKEN",
    });
  });

  it("rejects an unsupported signed version", () => {
    const service = createService();

    const token = signPayload({
      v: 1,
      submissionId,
      issuedAt,
    });

    expect(service.verify(token)).toEqual({
      ok: false,
      reason: "UNSUPPORTED_VERSION",
    });
  });

  it("rejects a signed payload with an invalid UUID", () => {
    const service = createService();

    const token = signPayload({
      v: 2,
      submissionId: "not-a-uuid",
      issuedAt,
      presentedAmountMinor,
      presentedCurrency,
    });

    expect(service.verify(token)).toEqual({
      ok: false,
      reason: "INVALID_PAYLOAD",
    });
  });

  it("rejects a signed payload with an invalid timestamp", () => {
    const service = createService();

    const token = signPayload({
      v: 2,
      submissionId,
      issuedAt: "2026-09-13",
      presentedAmountMinor,
      presentedCurrency,
    });

    expect(service.verify(token)).toEqual({
      ok: false,
      reason: "INVALID_PAYLOAD",
    });
  });

  it("returns only fixed error reasons", () => {
    const service = createService();

    const result = service.verify("***.###");

    expect(JSON.stringify(result)).not.toContain(secret);

    expect(JSON.stringify(result)).not.toContain(submissionId);
  });
});
