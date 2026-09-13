import { createHmac, randomUUID } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { HmacPaymentContinuation } from "../security/hmac-payment-continuation";
import { MercadoPagoAdapter } from "./mercado-pago-adapter";
import { verifyMercadoPagoWebhook } from "./mercado-pago-webhook-verifier";
import {
  decimalToMinor,
  minorToDecimal,
  normalizeMercadoPagoOrder,
} from "./normalize-mercado-pago-order";

const orderId = randomUUID();
const paymentId = randomUUID();
const secret = "p10-test-secret-of-at-least-thirty-two-bytes";

function providerOrder(status = "processed", detail = "accredited") {
  return {
    id: "ORD01J49MMW3SSBK5PSV3DFR32959",
    type: "online",
    processing_mode: "automatic",
    capture_mode: "automatic",
    external_reference: orderId,
    total_amount: "29.90",
    user_id: "12345",
    currency: "BRL",
    status,
    status_detail: detail,
    created_date: "2026-09-13T10:00:00Z",
    transactions: {
      payments: [
        {
          id: "PAY01J67CQQH5904WDBVZEM4JMEP3",
          amount: "29.90",
          status,
          status_detail: detail,
          payment_method: { id: "pix", type: "bank_transfer", qr_code: "000201..." },
        },
      ],
    },
  };
}

describe("P10 continuation capability", () => {
  it("authenticates scope and expiry without PII", () => {
    const service = new HmacPaymentContinuation(secret);
    const now = 1_780_000_000_000;
    const token = service.issue(orderId, now);
    expect(service.verify(token, now + 1000)?.orderId).toBe(orderId);
    expect(service.verify(token, now + 86_400_000)).toBeNull();
    expect(service.verify(token + "x", now)).toBeNull();
    expect(token).not.toContain("@example");
    const payload = {
      version: 1,
      purpose: "OTHER",
      orderId,
      issuedAt: now,
      expiresAt: now + 86_400_000,
    };
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const wrong = `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
    expect(service.verify(wrong, now)).toBeNull();
  });
});

describe("P10 provider normalization", () => {
  it("converts money exactly and rejects invalid decimals", () => {
    expect(minorToDecimal(2990)).toBe("29.90");
    expect(decimalToMinor("29.90")).toBe(2990);
    expect(decimalToMinor("29.9")).toBeNull();
    expect(decimalToMinor("29.901")).toBeNull();
  });

  it.each([
    ["created", "created", "PENDING"],
    ["processing", "in_process", "PENDING"],
    ["processing", "pending_review_manual", "PENDING"],
    ["processing", "in_review", "PENDING"],
    ["in_review", "in_review", "PENDING"],
    ["action_required", "waiting_payment", "PENDING"],
    ["action_required", "waiting_transfer", "PENDING"],
    ["action_required", "waiting_capture", "PENDING"],
    ["action_required", "pending_challenge", "PENDING"],
    ["action_required", "waiting_retry", "PENDING"],
    ["processed", "accredited", "APPROVED"],
    ["failed", "failed", "REJECTED"],
    ["failed", "cc_rejected_3ds_challenge", "REJECTED"],
    ["canceled", "canceled", "CANCELED"],
    ["expired", "expired", "CANCELED"],
    ["mystery", "future", "UNKNOWN"],
  ])("maps %s/%s conservatively", (status, detail, expected) => {
    const raw = providerOrder(status, detail);
    expect(normalizeMercadoPagoOrder(raw).status).toBe(expected);
  });

  it("requires currency evidence even when the order is approved", () => {
    const raw = providerOrder();
    const snapshot = normalizeMercadoPagoOrder({ ...raw, currency: undefined });
    expect(snapshot.status).toBe("APPROVED");
    expect(snapshot.requiresReview).toBe(true);
  });

  it("requires provider account and transaction identities for financial approval", () => {
    const raw = providerOrder();
    expect(normalizeMercadoPagoOrder({ ...raw, user_id: undefined }).requiresReview).toBe(true);
    const noPaymentId = {
      ...raw,
      transactions: { payments: [{ ...raw.transactions.payments[0], id: undefined }] },
    };
    expect(normalizeMercadoPagoOrder(noPaymentId).requiresReview).toBe(true);
  });

  it("keeps automatic capture anomalies in review and exposes HTTPS challenge only", () => {
    const capture = normalizeMercadoPagoOrder(providerOrder("action_required", "waiting_capture"));
    expect(capture.status).toBe("PENDING");
    expect(capture.reviewReason).toBe("UNEXPECTED_CAPTURE_MODE");
    const raw = providerOrder("action_required", "pending_challenge");
    const card = {
      ...raw,
      transactions: {
        payments: [
          {
            ...raw.transactions.payments[0],
            payment_method: {
              id: "visa",
              type: "credit_card",
              transaction_security: { url: "https://www.mercadopago.com/challenge" },
            },
          },
        ],
      },
    };
    expect(normalizeMercadoPagoOrder(card).presentation).toEqual({
      kind: "CHALLENGE",
      url: "https://www.mercadopago.com/challenge",
    });
    const unsafe = {
      ...card,
      transactions: {
        payments: [
          {
            ...card.transactions.payments[0],
            payment_method: {
              id: "visa",
              type: "credit_card",
              transaction_security: { url: "http://localhost/challenge" },
            },
          },
        ],
      },
    };
    expect(normalizeMercadoPagoOrder(unsafe).reviewReason).toBe("INVALID_PRESENTATION");
  });

  it("keeps partial refund and chargeback in review", () => {
    expect(
      normalizeMercadoPagoOrder(providerOrder("processed", "partially_refunded")).reviewReason,
    ).toBe("PARTIAL_REFUND");
    expect(normalizeMercadoPagoOrder(providerOrder("charged_back", "settled")).reviewReason).toBe(
      "CHARGEBACK",
    );
  });

  it("requires proven full refund", () => {
    const raw = providerOrder("refunded", "refunded");
    expect(normalizeMercadoPagoOrder(raw).reviewReason).toBe("UNPROVEN_FULL_REFUND");
    const withRefund = {
      ...raw,
      transactions: { ...raw.transactions, refunds: [{ status: "approved", amount: "29.90" }] },
    };
    expect(normalizeMercadoPagoOrder(withRefund).requiresReview).toBe(false);
  });
});

describe("P10 Orders API HTTP boundary", () => {
  it("sends the same local Payment.id as X-Idempotency-Key and authoritative Pix amount", async () => {
    const transport = vi.fn(async (_url: string | URL | Request, request?: RequestInit) => {
      expect(request?.headers).toMatchObject({ "X-Idempotency-Key": paymentId });
      const payload = JSON.parse(String(request?.body));
      expect(payload.external_reference).toBe(orderId);
      expect(payload.total_amount).toBe("29.90");
      expect(payload.transactions.payments[0].payment_method).toEqual({
        id: "pix",
        type: "bank_transfer",
      });
      return new Response(JSON.stringify(providerOrder()), { status: 201 });
    });
    const adapter = new MercadoPagoAdapter("test-access-token-fixture", transport as typeof fetch);
    const result = await adapter.createPayment({
      paymentId,
      orderId,
      amountMinor: 2990,
      currency: "BRL",
      paymentMethod: "PIX",
      payerEmail: "buyer@example.invalid",
    });
    expect(result.status).toBe("APPROVED");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("canonicalizes an incomplete Pix create response with GET before financial use", async () => {
    const complete = providerOrder("action_required", "waiting_transfer");
    const incomplete = {
      ...complete,
      user_id: undefined,
      currency: undefined,
    };

    let count = 0;

    const transport = vi.fn(async (url: string | URL | Request, request?: RequestInit) => {
      count += 1;

      if (count === 1) {
        expect(request?.method).toBe("POST");
        return new Response(JSON.stringify(incomplete), { status: 201 });
      }

      expect(request?.method).toBe("GET");
      expect(String(url)).toContain(`/v1/orders/${complete.id}`);

      return new Response(JSON.stringify(complete), { status: 200 });
    });

    const adapter = new MercadoPagoAdapter("test-access-token-fixture", transport as typeof fetch);

    const result = await adapter.createPayment({
      paymentId,
      orderId,
      amountMinor: 2990,
      currency: "BRL",
      paymentMethod: "PIX",
      payerEmail: "buyer@example.invalid",
    });

    expect(count).toBe(2);
    expect(result.status).toBe("PENDING");
    expect(result.requiresReview).toBe(false);
    expect(result.currency).toBe("BRL");
    expect(result.providerAccountId).toBe("12345");
    expect(result.providerOrderId).toBe(complete.id);
    expect(result.presentation?.kind).toBe("PIX");
  });

  it("carries provider order identity when canonical GET fails after successful create", async () => {
    const complete = providerOrder("action_required", "waiting_transfer");
    const incomplete = {
      ...complete,
      user_id: undefined,
      currency: undefined,
    };

    let count = 0;

    const transport = vi.fn(async (_url: string | URL | Request, request?: RequestInit) => {
      count += 1;

      if (count === 1) {
        expect(request?.method).toBe("POST");
        return new Response(JSON.stringify(incomplete), { status: 201 });
      }

      throw new Error("temporary canonical GET failure");
    });

    const adapter = new MercadoPagoAdapter("test-access-token-fixture", transport as typeof fetch);

    await expect(
      adapter.createPayment({
        paymentId,
        orderId,
        amountMinor: 2990,
        currency: "BRL",
        paymentMethod: "PIX",
        payerEmail: "buyer@example.invalid",
      }),
    ).rejects.toMatchObject({
      code: "AMBIGUOUS",
      retryable: true,
      providerOrderId: complete.id,
    });

    expect(count).toBe(3);
  });
  it("uses an ephemeral card token and 3DS configuration", async () => {
    const transport = vi.fn(async (_url: string | URL | Request, request?: RequestInit) => {
      const payload = JSON.parse(String(request?.body));
      expect(payload.capture_mode).toBe("automatic");
      expect(payload.config.online.transaction_security).toEqual({
        validation: "on_fraud_risk",
        liability_shift: "required",
      });
      expect(payload.transactions.payments[0].payment_method).toMatchObject({
        type: "credit_card",
        token: "ephemeral-fixture",
        installments: 1,
      });
      return new Response(JSON.stringify(providerOrder("action_required", "pending_challenge")), {
        status: 201,
      });
    });
    const adapter = new MercadoPagoAdapter("test-access-token-fixture", transport as typeof fetch);
    await adapter.createPayment({
      paymentId,
      orderId,
      amountMinor: 2990,
      currency: "BRL",
      paymentMethod: "CREDIT_CARD",
      payerEmail: "buyer@example.invalid",
      card: {
        token: "ephemeral-fixture",
        paymentMethodId: "visa",
        installments: 1,
        paymentType: "credit_card",
      },
    });
  });

  it("treats timeout and malformed provider JSON as unresolved", async () => {
    const failed = new MercadoPagoAdapter(
      "test-access-token-fixture",
      vi.fn(async () => {
        throw new Error("socket reset with secret text");
      }) as typeof fetch,
    );
    await expect(
      failed.createPayment({
        paymentId,
        orderId,
        amountMinor: 2990,
        currency: "BRL",
        paymentMethod: "PIX",
        payerEmail: "buyer@example.invalid",
      }),
    ).rejects.toMatchObject({ code: "AMBIGUOUS", message: "AMBIGUOUS" });
    const malformed = new MercadoPagoAdapter(
      "test-access-token-fixture",
      vi.fn(async () => new Response("{bad", { status: 200 })) as typeof fetch,
    );
    await expect(malformed.getSnapshot("ORD01J49MMW3SSBK5PSV3DFR32959")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("searches all pages without picking an arbitrary candidate", async () => {
    let page = 0;
    const transport = vi.fn(async (url: string | URL | Request) => {
      page += 1;
      expect(String(url)).toContain(`page=${page}`);
      return new Response(JSON.stringify({ data: [providerOrder()], paging: { total_pages: 2 } }));
    });
    const adapter = new MercadoPagoAdapter("test-access-token-fixture", transport as typeof fetch);
    const result = await adapter.searchPayments({
      externalReference: orderId,
      beginDate: "2026-09-13T00:00:00Z",
      endDate: "2026-09-13T02:00:00Z",
    });
    expect(result.snapshots).toHaveLength(2);
    expect(result.complete).toBe(true);
  });

  it("retries a transient GET once and honors a bounded Retry-After", async () => {
    let count = 0;
    const transport = vi.fn(async () => {
      count += 1;
      return count === 1
        ? new Response("", { status: 429, headers: { "retry-after": "0" } })
        : new Response(JSON.stringify(providerOrder()), { status: 200 });
    });
    const adapter = new MercadoPagoAdapter("test-access-token-fixture", transport as typeof fetch);
    expect((await adapter.getSnapshot("ORD01J49MMW3SSBK5PSV3DFR32959")).status).toBe("APPROVED");
    expect(count).toBe(2);
  });
});

describe("P10 webhook signature", () => {
  it("verifies signed resource ID with seconds or milliseconds and rejects replay", () => {
    const now = 1_780_000_000_000;
    for (const ts of [String(now / 1000), String(now)]) {
      const dataId = "ORD01J49MMW3SSBK5PSV3DFR32959";
      const requestId = "request-123";
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const digest = createHmac("sha256", secret).update(manifest).digest("hex");
      const signature = `ts=${ts},v1=${digest}`;
      expect(verifyMercadoPagoWebhook({ dataId, requestId, signature, secret, now })).toBe(true);
      expect(
        verifyMercadoPagoWebhook({ dataId, requestId, signature, secret, now: now + 301_000 }),
      ).toBe(false);
      expect(
        verifyMercadoPagoWebhook({
          dataId: dataId.toLowerCase(),
          requestId,
          signature,
          secret,
          now,
        }),
      ).toBe(false);
      expect(
        verifyMercadoPagoWebhook({ dataId, requestId: undefined, signature, secret, now }),
      ).toBe(false);
    }
  });
});
