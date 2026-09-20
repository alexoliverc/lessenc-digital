import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  ProviderError,
  type PaymentProvider,
  type ProviderSnapshot,
} from "../../modules/payments/application/payment-provider";
import { FinancialCoordinator } from "../../modules/payments/application/financial-coordinator";
import { createDatabaseClient } from "./client";
import { PrismaPaymentRepository } from "./prisma-payment-repository";

let db: ReturnType<typeof createDatabaseClient>;
let repo: PrismaPaymentRepository;
let ids: { product: string; offer: string; customer: string; order: string; item: string };

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw)
    throw new Error("P10 requires isolated test database");
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    !["/lessenc_test", "/lessenc_test_rebuild"].includes(url.pathname)
  ) {
    throw new Error("P10 refused non-test database");
  }
  return raw;
}

function snapshot(overrides: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return {
    providerOrderId: `ORD${randomUUID().replaceAll("-", "")}`,
    providerPaymentId: `PAY${randomUUID().replaceAll("-", "")}`,
    providerAccountId: null,
    externalReference: ids.order,
    amountMinor: 2990,
    paymentAmountMinor: 2990,
    currency: "BRL",
    paymentMethod: "PIX",
    paidAmountMinor: 2990,
    refundedAmountMinor: null,
    status: "APPROVED",
    requiresReview: false,
    reviewReason: null,
    providerStatus: "processed",
    providerStatusDetail: "accredited",
    occurredAt: "2026-09-13T10:00:00Z",
    createdAt: "2026-09-13T09:59:00Z",
    presentation: null,
    ...overrides,
  };
}

async function fixture() {
  const product = await db.product.create({ data: { name: "P10 fixture", status: "ACTIVE" } });
  const offer = await db.offer.create({
    data: { productId: product.id, priceMinor: 2990, currency: "BRL", isActive: true },
  });
  const customer = await db.customer.create({ data: { email: "p10@example.invalid" } });
  const order = await db.order.create({
    data: { customerId: customer.id, totalMinor: 2990, currency: "BRL" },
  });
  const item = await db.orderItem.create({
    data: {
      orderId: order.id,
      productId: product.id,
      offerId: offer.id,
      productNameSnapshot: product.name,
      unitPriceMinor: 2990,
      quantity: 1,
      totalMinor: 2990,
      currency: "BRL",
    },
  });
  ids = {
    product: product.id,
    offer: offer.id,
    customer: customer.id,
    order: order.id,
    item: item.id,
  };
}

describe("P10 financial persistence on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());
    await db.$connect();
    repo = new PrismaPaymentRepository(db);
  });
  beforeEach(fixture);
  afterEach(async () => {
    await db.paymentEvent.deleteMany({ where: { payment: { orderId: ids.order } } });
    await db.outboxEvent.deleteMany({ where: { orderId: ids.order } });
    await db.payment.deleteMany({ where: { orderId: ids.order } });
    await db.orderItem.deleteMany({ where: { id: ids.item } });
    await db.order.deleteMany({ where: { id: ids.order } });
    await db.customer.deleteMany({ where: { id: ids.customer } });
    await db.offer.deleteMany({ where: { id: ids.offer } });
    await db.product.deleteMany({ where: { id: ids.product } });
  });
  afterAll(async () => {
    await db?.$disconnect();
  });

  it("reserves exactly one active attempt under concurrent initiations", async () => {
    const results = await Promise.all([
      repo.reserve(ids.order, "PIX"),
      repo.reserve(ids.order, "PIX"),
    ]);
    expect(results.filter((result) => result.send)).toHaveLength(1);
    expect(new Set(results.map((result) => result.attempt.paymentId)).size).toBe(1);
    expect(await db.payment.count({ where: { orderId: ids.order } })).toBe(1);
    await expect(repo.reserve(ids.order, "CREDIT_CARD")).rejects.toThrow(
      "PAYMENT_ATTEMPT_CONFLICT",
    );
  });

  it("commits verified approval, journal and outbox atomically and deduplicates repeats", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const observation = snapshot();
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: observation,
        source: "CREATE_RESPONSE",
      }),
    ).toBe("APPLIED");
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: observation,
        source: "WEBHOOK",
      }),
    ).toBe("NOOP");
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "APPROVED",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PAID");
    expect(await db.paymentEvent.count({ where: { paymentId: attempt.paymentId } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(1);
    expect(await db.entitlement.count({ where: { orderItemId: ids.item } })).toBe(0);
  });

  it("rejects financial identity mismatch without approving", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const result = await repo.applyObservation({
      paymentId: attempt.paymentId,
      snapshot: snapshot({ amountMinor: 1 }),
      source: "WEBHOOK",
    });
    expect(result).toBe("REJECTED");
    const payment = await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } });
    expect(payment.status).toBe("PENDING");
    expect(payment.requiresReview).toBe(true);
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PENDING");
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(0);
  });

  it("rejection frees the marker but UNKNOWN preserves it", async () => {
    const first = await repo.reserve(ids.order, "PIX");
    await repo.applyObservation({
      paymentId: first.attempt.paymentId,
      snapshot: snapshot({
        status: "REJECTED",
        providerStatus: "failed",
        providerStatusDetail: "failed",
      }),
      source: "CREATE_RESPONSE",
    });
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PENDING");
    const next = await repo.reserve(ids.order, "CREDIT_CARD");
    expect(next.attempt.paymentId).not.toBe(first.attempt.paymentId);
    await repo.markAmbiguous(next.attempt.paymentId);
    await expect(repo.reserve(ids.order, "PIX")).rejects.toThrow("PAYMENT_ATTEMPT_CONFLICT");
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: next.attempt.paymentId } })).status,
    ).toBe("UNKNOWN");
  });

  it("keeps partial refund and chargeback under review without false refund", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const approved = snapshot();
    await repo.applyObservation({
      paymentId: attempt.paymentId,
      snapshot: approved,
      source: "CREATE_RESPONSE",
    });
    const partial = snapshot({
      providerOrderId: approved.providerOrderId,
      providerPaymentId: approved.providerPaymentId,
      providerStatus: "processed",
      providerStatusDetail: "partially_refunded",
      status: "UNKNOWN",
      requiresReview: true,
      reviewReason: "PARTIAL_REFUND",
    });
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: partial,
        source: "WEBHOOK",
      }),
    ).toBe("REVIEW");
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "APPROVED",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PAID");
    const chargeback = {
      ...partial,
      providerStatus: "charged_back",
      providerStatusDetail: "settled",
      reviewReason: "CHARGEBACK" as const,
    };
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: chargeback,
        source: "RECONCILIATION",
      }),
    ).toBe("REVIEW");

    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: snapshot({
          providerOrderId: approved.providerOrderId,
          providerPaymentId: approved.providerPaymentId,
          occurredAt: "2026-09-13T12:30:00Z",
        }),
        source: "RECONCILIATION",
      }),
    ).toBe("REVIEW");

    const reviewed = await db.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
    });

    expect(reviewed.requiresReview).toBe(true);
    expect(reviewed.status).toBe("APPROVED");
  });

  it("applies a proven full refund only after approval", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const approved = snapshot();
    await repo.applyObservation({
      paymentId: attempt.paymentId,
      snapshot: approved,
      source: "CREATE_RESPONSE",
    });
    const refunded = snapshot({
      providerOrderId: approved.providerOrderId,
      providerPaymentId: approved.providerPaymentId,
      status: "REFUNDED",
      providerStatus: "refunded",
      providerStatusDetail: "refunded",
      refundedAmountMinor: 2990,
      occurredAt: "2026-09-13T11:00:00Z",
    });
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: refunded,
        source: "WEBHOOK",
      }),
    ).toBe("APPLIED");
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "REFUNDED",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe(
      "REFUNDED",
    );
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(2);
    expect(await db.entitlement.count({ where: { orderItemId: ids.item } })).toBe(0);
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: { ...refunded, occurredAt: "2026-09-13T11:01:00Z" },
        source: "RECONCILIATION",
      }),
    ).toBe("NOOP");
  });

  it("releases an expired attempt without canceling its order", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: snapshot({
          status: "CANCELED",
          providerStatus: "expired",
          providerStatusDetail: "expired",
        }),
        source: "RECONCILIATION",
      }),
    ).toBe("APPLIED");
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PENDING");
    expect(
      (await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).activeAttemptKey,
    ).toBeNull();
    expect((await repo.reserve(ids.order, "PIX")).send).toBe(true);
  });

  it("selects the latest attempt deterministically by attempt number", async () => {
    const first = await repo.reserve(ids.order, "PIX");

    await repo.applyObservation({
      paymentId: first.attempt.paymentId,
      snapshot: snapshot({
        status: "REJECTED",
        providerStatus: "failed",
        providerStatusDetail: "failed",
      }),
      source: "CREATE_RESPONSE",
    });

    const second = await repo.reserve(ids.order, "PIX");

    const sameTime = new Date("2026-09-13T12:00:00.000Z");

    await db.payment.update({
      where: { id: first.attempt.paymentId },
      data: { createdAt: sameTime },
    });

    await db.payment.update({
      where: { id: second.attempt.paymentId },
      data: { createdAt: sameTime },
    });

    const current = await repo.state(ids.order);

    expect(current?.paymentId).toBe(second.attempt.paymentId);
    expect(current?.state).toBe("processing");
  });

  it("exposes refunded payment as a terminal public state", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const approved = snapshot();

    await repo.applyObservation({
      paymentId: attempt.paymentId,
      snapshot: approved,
      source: "CREATE_RESPONSE",
    });

    await repo.applyObservation({
      paymentId: attempt.paymentId,
      snapshot: snapshot({
        providerOrderId: approved.providerOrderId,
        providerPaymentId: approved.providerPaymentId,
        status: "REFUNDED",
        providerStatus: "refunded",
        providerStatusDetail: "refunded",
        refundedAmountMinor: 2990,
        occurredAt: "2026-09-13T11:30:00Z",
      }),
      source: "WEBHOOK",
    });

    expect((await repo.state(ids.order))?.state).toBe("refunded");
  });

  it("allows recoverable unknown provider status to reconcile later", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");

    const unknown = snapshot({
      status: "UNKNOWN",
      requiresReview: true,
      reviewReason: "UNKNOWN_STATUS",
      providerStatus: "future_status",
      providerStatusDetail: "future_detail",
    });

    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: unknown,
        source: "RECONCILIATION",
      }),
    ).toBe("APPLIED");

    let payment = await db.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
    });

    expect(payment.status).toBe("UNKNOWN");
    expect(payment.requiresReview).toBe(false);
    expect(payment.activeAttemptKey).toBe(ids.order);

    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: snapshot({
          providerOrderId: unknown.providerOrderId,
          providerPaymentId: unknown.providerPaymentId,
          occurredAt: "2026-09-13T12:01:00Z",
        }),
        source: "RECONCILIATION",
      }),
    ).toBe("APPLIED");

    payment = await db.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
    });

    expect(payment.status).toBe("APPROVED");
    expect(payment.requiresReview).toBe(false);

    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PAID");
  });

  it("keeps incomplete recovery searchable without permanent review", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");

    await repo.markAmbiguous(attempt.paymentId);

    await repo.recordRecoveryReview(attempt.paymentId, "INCOMPLETE_SEARCH");

    let payment = await db.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
    });

    expect(payment.status).toBe("UNKNOWN");
    expect(payment.requiresReview).toBe(false);
    expect(payment.activeAttemptKey).toBe(ids.order);

    const approved = snapshot();

    expect(
      await repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: approved,
        source: "RECONCILIATION",
      }),
    ).toBe("APPLIED");

    payment = await db.payment.findUniqueOrThrow({
      where: { id: attempt.paymentId },
    });

    expect(payment.status).toBe("APPROVED");
    expect(payment.requiresReview).toBe(false);
  });
  it("throttles concurrent public reconciliation to one provider lookup", async () => {
    await repo.reserve(ids.order, "PIX");

    let searches = 0;

    const coordinator = new FinancialCoordinator(repo, {
      createPayment: async () => {
        throw new Error("should not create");
      },
      getSnapshot: async () => {
        throw new Error("provider order is not known yet");
      },
      searchPayments: async () => {
        searches += 1;

        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          snapshots: [],
          complete: true,
        };
      },
    });

    const results = await Promise.all([
      coordinator.status(ids.order),
      coordinator.status(ids.order),
      coordinator.status(ids.order),
      coordinator.status(ids.order),
      coordinator.status(ids.order),
    ]);

    expect(results).toHaveLength(5);
    expect(searches).toBe(1);

    expect(
      (
        await db.payment.findFirstOrThrow({
          where: { orderId: ids.order },
        })
      ).lastProviderSyncAt,
    ).not.toBeNull();
  });

  it("does not expose a 3DS challenge when provider identity is not associated with the order", async () => {
    const provider: PaymentProvider = {
      createPayment: async () =>
        snapshot({
          externalReference: randomUUID(),
          paymentMethod: "CREDIT_CARD",
          paidAmountMinor: null,
          status: "PENDING",
          providerStatus: "action_required",
          providerStatusDetail: "pending_challenge",
          presentation: {
            kind: "CHALLENGE",
            url: "https://acs-public.tp.mastercard.com/api/v1/browser_Challenges",
          },
        }),
      getSnapshot: async () => {
        throw new Error("must not reconcile");
      },
      searchPayments: async () => {
        throw new Error("must not search");
      },
    };
    const coordinator = new FinancialCoordinator(repo, provider);

    const result = await coordinator.start(ids.order, "CREDIT_CARD", {
      token: "card-token-fixture",
      paymentMethodId: "master",
      installments: 1,
      paymentType: "credit_card",
    });

    expect(result.presentation).toBeNull();
    expect(result.state).toBe("review_required");
    expect(await db.payment.findFirstOrThrow({ where: { orderId: ids.order } })).toMatchObject({
      requiresReview: true,
      reviewReason: "IDENTITY_OR_AMOUNT_MISMATCH",
    });
  });

  it("rolls back all financial changes if outbox write fails", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    await db.outboxEvent.create({
      data: {
        orderId: ids.order,
        type: "PAYMENT_APPROVED",
        deduplicationKey: `payment-approved:${attempt.paymentId}`,
        payload: { version: 1 },
      },
    });
    await expect(
      repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: snapshot(),
        source: "CREATE_RESPONSE",
      }),
    ).rejects.toThrow();
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "PENDING",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PENDING");
    expect(await db.paymentEvent.count({ where: { paymentId: attempt.paymentId } })).toBe(0);
  });

  it("serializes webhook and reconciliation observations to one effect", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const observation = snapshot();
    const results = await Promise.all([
      repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: observation,
        source: "WEBHOOK",
      }),
      repo.applyObservation({
        paymentId: attempt.paymentId,
        snapshot: observation,
        source: "RECONCILIATION",
      }),
    ]);
    expect(results.sort()).toEqual(["APPLIED", "NOOP"]);
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(1);
  });

  it("preserves created provider identity after canonical GET failure and later reconciles", async () => {
    const observation = snapshot();

    const provider: PaymentProvider = {
      createPayment: async () => {
        throw new ProviderError("AMBIGUOUS", true, observation.providerOrderId);
      },
      getSnapshot: async (providerOrderId) => {
        expect(providerOrderId).toBe(observation.providerOrderId);
        return observation;
      },
      searchPayments: async () => {
        throw new Error("provider order identity should avoid Search recovery");
      },
    };

    const coordinator = new FinancialCoordinator(repo, provider);

    const started = await coordinator.start(ids.order, "PIX");

    expect(started.state).toBe("unknown");

    const ambiguous = await db.payment.findFirstOrThrow({
      where: { orderId: ids.order },
    });

    expect(ambiguous.status).toBe("UNKNOWN");
    expect(ambiguous.providerOrderId).toBe(observation.providerOrderId);
    expect(ambiguous.activeAttemptKey).toBe(ids.order);

    expect(await coordinator.reconcile(ambiguous.id)).toBeNull();

    const recovered = await db.payment.findUniqueOrThrow({
      where: { id: ambiguous.id },
    });

    expect(recovered.status).toBe("APPROVED");
    expect(recovered.providerOrderId).toBe(observation.providerOrderId);

    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PAID");

    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(1);
    expect(await db.entitlement.count({ where: { orderItemId: ids.item } })).toBe(0);
  });
  it("recovers a lost creation response by searching a bounded window", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    await repo.markAmbiguous(attempt.paymentId);
    const observation = snapshot();
    const provider: PaymentProvider = {
      createPayment: async () => {
        throw new Error("should not create again");
      },
      getSnapshot: async (providerOrderId) => {
        expect(providerOrderId).toBe(observation.providerOrderId);
        return observation;
      },
      searchPayments: async ({ externalReference, beginDate, endDate }) => {
        expect(externalReference).toBe(ids.order);
        expect(Date.parse(endDate) - Date.parse(beginDate)).toBe(2 * 60 * 60_000 + 5 * 60_000);
        return { snapshots: [observation], complete: true };
      },
    };
    const coordinator = new FinancialCoordinator(repo, provider);
    await coordinator.reconcile(attempt.paymentId);
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "APPROVED",
    );
    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PAID");
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(1);
  });

  it("keeps no-match recovery UNKNOWN and multiple candidates in review", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    await repo.markAmbiguous(attempt.paymentId);
    let candidates: ProviderSnapshot[] = [];
    const coordinator = new FinancialCoordinator(repo, {
      createPayment: async () => {
        throw new Error("should not create again");
      },
      getSnapshot: async () => {
        throw new Error("should not pick a candidate");
      },
      searchPayments: async () => ({ snapshots: candidates, complete: true }),
    });
    expect(await coordinator.reconcile(attempt.paymentId)).toBeNull();
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "UNKNOWN",
    );
    candidates = [snapshot(), snapshot()];
    expect(await coordinator.reconcile(attempt.paymentId)).toBeNull();
    const payment = await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } });
    expect(payment.requiresReview).toBe(true);
    expect(payment.activeAttemptKey).toBe(ids.order);
    expect(await db.paymentEvent.count({ where: { paymentId: attempt.paymentId } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(0);
  });

  it("recovers the active second attempt after a historical rejected attempt", async () => {
    const first = await repo.reserve(ids.order, "PIX");

    await repo.applyObservation({
      paymentId: first.attempt.paymentId,
      snapshot: snapshot({
        status: "REJECTED",
        providerStatus: "failed",
        providerStatusDetail: "failed",
      }),
      source: "CREATE_RESPONSE",
    });

    const second = await repo.reserve(ids.order, "PIX");
    expect(second.attempt.paymentId).not.toBe(first.attempt.paymentId);

    const observation = snapshot();

    const coordinator = new FinancialCoordinator(repo, {
      createPayment: async () => {
        throw new Error("should not POST");
      },
      getSnapshot: async (providerOrderId) => {
        expect(providerOrderId).toBe(observation.providerOrderId);
        return observation;
      },
      searchPayments: async () => {
        throw new Error("should not search");
      },
    });

    expect(await coordinator.webhook(observation.providerOrderId)).toBe("APPLIED");

    const firstPayment = await db.payment.findUniqueOrThrow({
      where: { id: first.attempt.paymentId },
    });

    const secondPayment = await db.payment.findUniqueOrThrow({
      where: { id: second.attempt.paymentId },
    });

    expect(firstPayment.status).toBe("REJECTED");
    expect(secondPayment.status).toBe("APPROVED");

    expect((await db.order.findUniqueOrThrow({ where: { id: ids.order } })).status).toBe("PAID");

    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(1);
    expect(await db.entitlement.count({ where: { orderItemId: ids.item } })).toBe(0);
  });
  it("webhook lookup associates only the first active attempt and commits after GET", async () => {
    const { attempt } = await repo.reserve(ids.order, "PIX");
    const observation = snapshot();
    const coordinator = new FinancialCoordinator(repo, {
      createPayment: async () => {
        throw new Error("should not POST");
      },
      getSnapshot: async () => observation,
      searchPayments: async () => {
        throw new Error("should not search");
      },
    });
    expect(await coordinator.webhook(observation.providerOrderId)).toBe("APPLIED");
    expect(await coordinator.webhook(observation.providerOrderId)).toBe("NOOP");
    expect((await db.payment.findUniqueOrThrow({ where: { id: attempt.paymentId } })).status).toBe(
      "APPROVED",
    );
    expect(await db.outboxEvent.count({ where: { orderId: ids.order } })).toBe(1);
  });
});
