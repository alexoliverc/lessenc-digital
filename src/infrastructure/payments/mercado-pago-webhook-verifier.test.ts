import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  diagnoseMercadoPagoWebhook,
  verifyMercadoPagoWebhook,
  type MercadoPagoWebhookRejectionReason,
} from "./mercado-pago-webhook-verifier";

const secret = "p17-e05-diagnostic-secret-fixture";
const dataId = "ORDTST01SYNTHETICTESTORDER000000001";
const requestId = "p17-e05-request-fixture";
const now = 1_792_100_000_000;

function signatureFor(
  timestamp: string,
  overrides: Readonly<{
    resource?: string;
    request?: string;
    key?: string;
    lowercaseResource?: boolean;
  }> = {},
): string {
  const resource = overrides.resource ?? dataId;
  const signedResource = overrides.lowercaseResource ? resource.toLowerCase() : resource;
  const manifest = `id:${signedResource};request-id:${overrides.request ?? requestId};ts:${timestamp};`;
  const digest = createHmac("sha256", overrides.key ?? secret)
    .update(manifest)
    .digest("hex");

  return `ts=${timestamp},v1=${digest}`;
}

function expectRejection(
  reason: MercadoPagoWebhookRejectionReason,
  overrides: Partial<Parameters<typeof diagnoseMercadoPagoWebhook>[0]>,
): void {
  expect(
    diagnoseMercadoPagoWebhook({
      dataId,
      requestId,
      signature: signatureFor(String(now)),
      secret,
      now,
      ...overrides,
    }),
  ).toEqual({ valid: false, reason });
}

describe("P17-E05 Mercado Pago webhook rejection diagnostics", () => {
  it.each([String(now / 1000), String(now)])(
    "accepts the real TEST Order ID shape with timestamp %s",
    (timestamp) => {
      const input = {
        dataId,
        requestId,
        signature: signatureFor(timestamp),
        secret,
        now,
      };

      expect(diagnoseMercadoPagoWebhook(input)).toEqual({ valid: true });
      expect(verifyMercadoPagoWebhook(input)).toBe(true);
    },
  );

  it("classifies an incorrect HMAC without returning request values", () => {
    const result = diagnoseMercadoPagoWebhook({
      dataId,
      requestId,
      signature: signatureFor(String(now), { key: "different-test-key" }),
      secret,
      now,
    });

    expect(result).toEqual({ valid: false, reason: "HMAC_MISMATCH" });
    expect(JSON.stringify(result)).not.toContain(dataId);
    expect(JSON.stringify(result)).not.toContain(requestId);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("accepts the case-preserving Orders contract and rejects a lowercased manifest", () => {
    const casePreservingSignature = signatureFor(String(now));
    const lowercasedSignature = signatureFor(String(now), { lowercaseResource: true });

    expect(
      diagnoseMercadoPagoWebhook({
        dataId,
        requestId,
        signature: casePreservingSignature,
        secret,
        now,
      }),
    ).toEqual({ valid: true });

    const result = diagnoseMercadoPagoWebhook({
      dataId,
      requestId,
      signature: lowercasedSignature,
      secret,
      now,
    });

    expect(result).toEqual({ valid: false, reason: "HMAC_MISMATCH" });
  });

  it("classifies timestamps outside the unchanged five-minute window", () => {
    expectRejection("TIMESTAMP_OUT_OF_WINDOW", {
      signature: signatureFor(String(now - 301_000)),
    });
    expectRejection("TIMESTAMP_OUT_OF_WINDOW", {
      signature: signatureFor(String(now + 301_000)),
    });
    expectRejection("TIMESTAMP_INVALID", {
      signature: `ts=not-a-timestamp,v1=${"a".repeat(64)}`,
    });
  });

  it("classifies missing inputs and invalid Order or request identifiers", () => {
    expectRejection("SECRET_MISSING", { secret: "" });
    expectRejection("DATA_ID_MISSING", { dataId: null });
    expectRejection("DATA_ID_INVALID", { dataId: "PAYTST01SYNTHETICTESTORDER000000001" });
    expectRejection("SIGNATURE_MISSING", { signature: null });
    expectRejection("REQUEST_ID_MISSING", { requestId: null });
    expectRejection("REQUEST_ID_INVALID", { requestId: "request id with spaces" });
  });

  it("classifies malformed signature syntax without accepting extra components", () => {
    expectRejection("SIGNATURE_MALFORMED", { signature: "invalid" });
    expectRejection("SIGNATURE_MALFORMED", {
      signature: `${signatureFor(String(now))},v2=${"b".repeat(64)}`,
    });
    expectRejection("TIMESTAMP_MISSING", { signature: `v1=${"a".repeat(64)},other=value` });
    expectRejection("DIGEST_MISSING", { signature: `ts=${now},other=value` });
    expectRejection("DIGEST_INVALID", { signature: `ts=${now},v1=not-a-digest` });
  });
});
