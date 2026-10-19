import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { paymentServices } from "@/app/checkout/payment/payment.server";

import { POST } from "./route";

vi.mock("@/app/checkout/payment/payment.server", () => ({ paymentServices: vi.fn() }));

const id = "ORD01J49MMW3SSBK5PSV3DFR32959";
const requestId = "p10-webhook-fixture";
const secret = "p10-test-webhook-secret-fixture";
const original = process.env.MERCADOPAGO_WEBHOOK_SECRET;
const paymentServicesMock = vi.mocked(paymentServices);

function signedRequest(body: string, query = `?type=order&data.id=${id}`): Request {
  return signedRequestAt(body, Date.now(), query);
}

function signedRequestAt(
  body: string,
  timestamp: number,
  query = `?type=order&data.id=${id}`,
): Request {
  const ts = String(timestamp);
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const digest = createHmac("sha256", secret).update(manifest).digest("hex");
  return new Request(`http://localhost/api/webhooks/mercadopago${query}`, {
    method: "POST",
    body,
    headers: { "x-signature": `ts=${ts},v1=${digest}`, "x-request-id": requestId },
  });
}

function signedOrderRequest(
  body: string,
  orderId: string,
  timestamp = Date.now(),
  lowercaseOrderId = false,
  signingSecret = secret,
): Request {
  const ts = String(timestamp);
  const signedOrderId = lowercaseOrderId ? orderId.toLowerCase() : orderId;
  const manifest = `id:${signedOrderId};request-id:${requestId};ts:${ts};`;
  const digest = createHmac("sha256", signingSecret).update(manifest).digest("hex");

  return new Request(`http://localhost/api/webhooks/mercadopago?type=order&data.id=${orderId}`, {
    method: "POST",
    body,
    headers: { "x-signature": `ts=${ts},v1=${digest}`, "x-request-id": requestId },
  });
}

describe("P10 webhook input boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    paymentServicesMock.mockReset();
    if (original === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    else process.env.MERCADOPAGO_WEBHOOK_SECRET = original;
  });

  function expectNoPaymentSideEffects(): void {
    expect(paymentServicesMock).not.toHaveBeenCalled();
  }

  it("rejects an unsigned resource before touching payment data", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = new Request(
      `http://localhost/api/webhooks/mercadopago?type=order&data.id=${id}`,
      {
        method: "POST",
        body: JSON.stringify({ type: "order", data: { id } }),
      },
    );
    expect((await POST(request)).status).toBe(401);

    const missingRequestId = signedRequest(JSON.stringify({ type: "order", data: { id } }));
    missingRequestId.headers.delete("x-request-id");
    expect((await POST(missingRequestId)).status).toBe(401);

    const missingSignature = signedRequest(JSON.stringify({ type: "order", data: { id } }));
    missingSignature.headers.delete("x-signature");
    expect((await POST(missingSignature)).status).toBe(401);
    expectNoPaymentSideEffects();

    const rejectionRecords = warn.mock.calls
      .map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>)
      .filter((entry) => entry.event === "webhook_invalid_signature");
    expect(rejectionRecords).toHaveLength(3);
    expect(rejectionRecords.every((entry) => !("hmacDifferential" in entry))).toBe(true);
  });

  it("rejects malformed, expired, future and wrong-request-id signatures", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ type: "order", data: { id } });

    const malformed = signedRequest(body);
    malformed.headers.set("x-signature", "invalid");
    expect((await POST(malformed)).status).toBe(401);

    const incorrectHmac = signedRequest(body);
    const validSignature = incorrectHmac.headers.get("x-signature")!;
    incorrectHmac.headers.set(
      "x-signature",
      validSignature.replace(/v1=([0-9a-f])/u, (_match, first: string) =>
        first === "0" ? "v1=1" : "v1=0",
      ),
    );
    expect((await POST(incorrectHmac)).status).toBe(401);

    expect((await POST(signedRequestAt(body, Date.now() - 301_000))).status).toBe(401);
    expect((await POST(signedRequestAt(body, Date.now() + 301_000))).status).toBe(401);

    const wrongRequestId = signedRequest(body);
    wrongRequestId.headers.set("x-request-id", "different-request-id");
    expect((await POST(wrongRequestId)).status).toBe(401);
    expectNoPaymentSideEffects();
  });

  it("rejects malformed timestamp and digest before payment side effects", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ type: "order", data: { id } });

    const malformedTimestamp = signedRequest(body);
    malformedTimestamp.headers.set("x-signature", `ts=not-a-timestamp,v1=${"a".repeat(64)}`);
    expect((await POST(malformedTimestamp)).status).toBe(401);

    const malformedDigest = signedRequest(body);
    malformedDigest.headers.set("x-signature", `ts=${Date.now()},v1=not-a-digest`);
    expect((await POST(malformedDigest)).status).toBe(401);
    expectNoPaymentSideEffects();
  });

  it("rejects duplicate query values and inconsistent authenticated envelope", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    expect(
      (await POST(signedRequest("{}", `?type=order&data.id=${id}&data.id=${id}`))).status,
    ).toBe(400);
    expect((await POST(signedRequest("{}", `?type=order&type=order&data.id=${id}`))).status).toBe(
      400,
    );
    expect((await POST(signedRequest("{}", "?type=order"))).status).toBe(400);
    expect(
      (await POST(signedRequest(JSON.stringify({ type: "order", data: { id: "ORDOTHER" } }))))
        .status,
    ).toBe(400);
    expectNoPaymentSideEffects();
  });

  it("rejects an oversized body and invalid JSON after authentication", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    expect((await POST(signedRequest("x".repeat(9000)))).status).toBe(413);
    expect((await POST(signedRequest("not-json"))).status).toBe(400);
    expectNoPaymentSideEffects();
  });

  it("accepts the case-preserving Orders contract without a lowercase fallback", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const testOrderId = "ORDTST01SYNTHETICTESTORDER000000001";
    const webhook = vi.fn().mockResolvedValue("APPLIED");
    paymentServicesMock.mockReturnValue({ coordinator: { webhook } } as never);

    const accepted = await POST(
      signedOrderRequest(JSON.stringify({ type: "order", data: { id: testOrderId } }), testOrderId),
    );

    expect(accepted.status).toBe(200);
    expect(paymentServicesMock).toHaveBeenCalledTimes(1);
    expect(webhook).toHaveBeenCalledWith(testOrderId);
    expect(warn).not.toHaveBeenCalled();

    paymentServicesMock.mockClear();
    webhook.mockClear();

    expect((await POST(signedOrderRequest("not-json", testOrderId, Date.now(), true))).status).toBe(
      401,
    );
    expectNoPaymentSideEffects();
    expect(webhook).not.toHaveBeenCalled();
    expect(warn.mock.calls).toHaveLength(1);
    expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toMatchObject({
      rejectionReason: "HMAC_MISMATCH",
      hmacDifferential: "LOWERCASE_CASE_MATCH",
    });
  });

  it.each([
    ["LOWERCASE_CASE_MATCH", true, secret],
    ["NEITHER_MATCH", false, "different-synthetic-signing-secret"],
  ] as const)(
    "keeps HMAC mismatch fail-closed and logs only %s",
    async (expectedDifferential, lowercaseOrderId, signingSecret) => {
      process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const body = JSON.stringify({ type: "order", data: { id } });
      const request = signedOrderRequest(body, id, Date.now(), lowercaseOrderId, signingSecret);
      const presentedSignature = request.headers.get("x-signature")!;

      const response = await POST(request);
      expect(response.status).toBe(401);
      expect(await response.text()).toBe("");
      expectNoPaymentSideEffects();

      const record = warn.mock.calls
        .map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>)
        .find((entry) => entry.event === "webhook_invalid_signature");
      expect(record).toMatchObject({
        rejectionReason: "HMAC_MISMATCH",
        hmacDifferential: expectedDifferential,
      });

      const completedSpan = info.mock.calls
        .map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>)
        .find((entry) => entry.event === "operational_span_completed");
      expect(completedSpan).toMatchObject({
        outcome: "DENIED",
        failureCode: "SIGNATURE_INVALID",
      });

      const serialized = JSON.stringify([warn.mock.calls, info.mock.calls, error.mock.calls]);
      for (const forbidden of [secret, signingSecret, id, requestId, presentedSignature]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(record).not.toHaveProperty("signature");
      expect(record).not.toHaveProperty("requestId");
      expect(record).not.toHaveProperty("dataId");
      expect(record).not.toHaveProperty("ip");
    },
  );

  it("classifies a tampered digest as NEITHER without leaking request material", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = signedRequest(JSON.stringify({ type: "order", data: { id } }));
    const validSignature = request.headers.get("x-signature")!;
    request.headers.set(
      "x-signature",
      validSignature.replace(/v1=([0-9a-f])/u, (_match, first: string) =>
        first === "0" ? "v1=1" : "v1=0",
      ),
    );

    expect((await POST(request)).status).toBe(401);
    expectNoPaymentSideEffects();

    const record = warn.mock.calls
      .map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>)
      .find((entry) => entry.event === "webhook_invalid_signature");
    expect(record).toMatchObject({
      rejectionReason: "HMAC_MISMATCH",
      hmacDifferential: "NEITHER_MATCH",
    });
    expect(JSON.stringify(record)).not.toContain(request.headers.get("x-signature")!);
  });
});
