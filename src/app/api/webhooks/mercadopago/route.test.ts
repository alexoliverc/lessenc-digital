import { createHmac } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { POST } from "./route";

const id = "ORD01J49MMW3SSBK5PSV3DFR32959";
const requestId = "p10-webhook-fixture";
const secret = "p10-test-webhook-secret-fixture";
const original = process.env.MERCADOPAGO_WEBHOOK_SECRET;

function signedRequest(body: string, query = `?type=order&data.id=${id}`): Request {
  const ts = String(Date.now());
  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const digest = createHmac("sha256", secret).update(manifest).digest("hex");
  return new Request(`http://localhost/api/webhooks/mercadopago${query}`, {
    method: "POST",
    body,
    headers: { "x-signature": `ts=${ts},v1=${digest}`, "x-request-id": requestId },
  });
}

describe("P10 webhook input boundary", () => {
  afterEach(() => {
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
});
