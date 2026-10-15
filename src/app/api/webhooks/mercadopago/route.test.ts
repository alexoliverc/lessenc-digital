import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const id = "ORD01J49MMW3SSBK5PSV3DFR32959";
const requestId = "p10-webhook-fixture";
const secret = "p10-test-webhook-secret-fixture";
const original = process.env.MERCADOPAGO_WEBHOOK_SECRET;

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
): Request {
  const ts = String(timestamp);
  const signedOrderId = lowercaseOrderId ? orderId.toLowerCase() : orderId;
  const manifest = `id:${signedOrderId};request-id:${requestId};ts:${ts};`;
  const digest = createHmac("sha256", secret).update(manifest).digest("hex");

  return new Request(`http://localhost/api/webhooks/mercadopago?type=order&data.id=${orderId}`, {
    method: "POST",
    body,
    headers: { "x-signature": `ts=${ts},v1=${digest}`, "x-request-id": requestId },
  });
}

describe("P10 webhook input boundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    if (original === undefined) delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
    else process.env.MERCADOPAGO_WEBHOOK_SECRET = original;
  });

  it("rejects an unsigned resource before touching payment data", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
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
  });

  it("rejects duplicate query values and inconsistent authenticated envelope", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    expect(
      (await POST(signedRequest("{}", `?type=order&data.id=${id}&data.id=${id}`))).status,
    ).toBe(400);
    expect(
      (await POST(signedRequest(JSON.stringify({ type: "order", data: { id: "ORDOTHER" } }))))
        .status,
    ).toBe(400);
  });

  it("rejects an oversized body and invalid JSON after authentication", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    expect((await POST(signedRequest("x".repeat(9000)))).status).toBe(413);
    expect((await POST(signedRequest("not-json"))).status).toBe(400);
  });

  it("accepts the case-preserving Orders contract and rejects a lowercased manifest", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const testOrderId = "ORDTST01SYNTHETICTESTORDER000000001";

    expect((await POST(signedOrderRequest("not-json", testOrderId))).status).toBe(400);
    expect((await POST(signedOrderRequest("not-json", testOrderId, Date.now(), true))).status).toBe(
      401,
    );
  });

  it("logs only a closed rejection reason for an incorrect HMAC", async () => {
    process.env.MERCADOPAGO_WEBHOOK_SECRET = secret;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const body = JSON.stringify({ type: "order", data: { id } });
    const request = signedRequest(body);
    const presentedSignature = request.headers.get("x-signature")!;
    request.headers.set("x-request-id", "different-request-id");

    expect((await POST(request)).status).toBe(401);

    const record = warn.mock.calls
      .map(([entry]) => JSON.parse(String(entry)) as Record<string, unknown>)
      .find((entry) => entry.event === "webhook_invalid_signature");
    expect(record).toMatchObject({ rejectionReason: "HMAC_MISMATCH" });

    const serialized = JSON.stringify(record);
    for (const forbidden of [secret, id, requestId, "different-request-id", presentedSignature]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(record).not.toHaveProperty("signature");
    expect(record).not.toHaveProperty("requestId");
    expect(record).not.toHaveProperty("dataId");
    expect(record).not.toHaveProperty("ip");
  });
});
