import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ProjectCanonicalPurchase,
  ReconcileCanonicalPurchases,
} from "../../modules/analytics/application/canonical-purchase";
import { CanonicalPurchaseFinancialObserver } from "../../modules/analytics/application/canonical-purchase-observer";
import { FinancialCoordinator } from "../../modules/payments/application/financial-coordinator";
import type {
  PaymentProvider,
  ProviderSnapshot,
} from "../../modules/payments/application/payment-provider";
import { createDatabaseClient } from "./client";
import { PrismaCanonicalPurchaseRepository } from "./prisma-canonical-purchase-repository";
import { PrismaPaymentRepository } from "./prisma-payment-repository";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P13-E requires APP_ENV=test and TEST_DATABASE_URL");
  }

  const url = new URL(raw);

  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    url.pathname !== "/lessenc_test"
  ) {
    throw new Error("P13-E refused a non-isolated P06 test database");
  }

  return raw;
}

type FixtureIds = Readonly<{
  product: string;
  offer: string;
  customer: string;
  order: string;
  item: string;
  journey: string;
  touch: string;
  orderAttribution: string;
}>;

let db: ReturnType<typeof createDatabaseClient>;
let payments: PrismaPaymentRepository;
let purchases: PrismaCanonicalPurchaseRepository;
let projector: ProjectCanonicalPurchase;
let ids: FixtureIds;

function approvedSnapshot(overrides: Partial<ProviderSnapshot> = {}): ProviderSnapshot {
  return Object.freeze({
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
    occurredAt: "2026-09-19T15:00:00.000Z",
    createdAt: "2026-09-19T14:59:00.000Z",
    presentation: null,
    ...overrides,
  });
}

async function createFixture(): Promise<void> {
  const product = await db.product.create({
    data: {
      name: "P13-E product",
      status: "ACTIVE",
    },
  });
  const offer = await db.offer.create({
    data: {
      productId: product.id,
      priceMinor: 2990,
      currency: "BRL",
      isActive: true,
    },
  });
  const customer = await db.customer.create({
    data: {
      email: `p13-e-${randomUUID()}@example.test`,
    },
  });
  const order = await db.order.create({
    data: {
      customerId: customer.id,
      status: "PENDING",
      totalMinor: 2990,
      currency: "BRL",
    },
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
  const journey = await db.acquisitionJourney.create({
    data: {
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000),
      analyticsConsentState: "GRANTED",
      advertisingConsentState: "DENIED",
      policyVersion: "p13-architecture-freeze-r2",
    },
  });
  const touch = await db.attributionTouch.create({
    data: {
      journeyId: journey.id,
      occurredAt: new Date(),
      source: "p13-e-source",
      medium: "test",
      campaign: "purchase",
      content: null,
      term: null,
      referrerHost: null,
      landingPath: "/cronograma-capilar-inteligente",
      touchType: "CAMPAIGN",
    },
  });

  await db.acquisitionJourney.update({
    where: {
      id: journey.id,
    },
    data: {
      firstTouchId: touch.id,
      lastTouchId: touch.id,
    },
  });

  const orderAttribution = await db.orderAttribution.create({
    data: {
      orderId: order.id,
      journeyId: journey.id,
      firstTouchId: touch.id,
      lastTouchId: touch.id,
      firstSource: "p13-e-source",
      firstMedium: "test",
      firstCampaign: "purchase",
      firstContent: null,
      firstTerm: null,
      lastSource: "p13-e-source",
      lastMedium: "test",
      lastCampaign: "purchase",
      lastContent: null,
      lastTerm: null,
    },
  });

  ids = Object.freeze({
    product: product.id,
    offer: offer.id,
    customer: customer.id,
    order: order.id,
    item: item.id,
    journey: journey.id,
    touch: touch.id,
    orderAttribution: orderAttribution.id,
  });
}

async function cleanupFixture(): Promise<void> {
  if (!ids) {
    return;
  }

  await db.analyticsDispatch.deleteMany({
    where: {
      analyticsEvent: {
        orderId: ids.order,
      },
    },
  });
  await db.analyticsEvent.deleteMany({
    where: {
      orderId: ids.order,
    },
  });
  await db.entitlement.deleteMany({
    where: {
      orderItemId: ids.item,
    },
  });
  await db.paymentEvent.deleteMany({
    where: {
      payment: {
        orderId: ids.order,
      },
    },
  });
  await db.outboxEvent.deleteMany({
    where: {
      orderId: ids.order,
    },
  });
  await db.payment.deleteMany({
    where: {
      orderId: ids.order,
    },
  });
  await db.orderAttribution.deleteMany({
    where: {
      id: ids.orderAttribution,
    },
  });
  await db.orderItem.deleteMany({
    where: {
      id: ids.item,
    },
  });
  await db.order.deleteMany({
    where: {
      id: ids.order,
    },
  });
  await db.customer.deleteMany({
    where: {
      id: ids.customer,
    },
  });
  await db.attributionTouch.deleteMany({
    where: {
      id: ids.touch,
    },
  });
  await db.acquisitionJourney.deleteMany({
    where: {
      id: ids.journey,
    },
  });
  await db.offer.deleteMany({
    where: {
      id: ids.offer,
    },
  });
  await db.product.deleteMany({
    where: {
      id: ids.product,
    },
  });
}

async function approvePayment(): Promise<{
  paymentId: string;
  snapshot: ProviderSnapshot;
}> {
  const { attempt } = await payments.reserve(ids.order, "PIX");
  const snapshot = approvedSnapshot();

  await expect(
    payments.applyObservation({
      paymentId: attempt.paymentId,
      snapshot,
      source: "WEBHOOK",
    }),
  ).resolves.toBe("APPLIED");

  return {
    paymentId: attempt.paymentId,
    snapshot,
  };
}

function provider(snapshot: ProviderSnapshot): PaymentProvider {
  return {
    createPayment: async () => snapshot,
    getSnapshot: async () => snapshot,
    searchPayments: async () => ({
      snapshots: [snapshot],
      complete: true,
    }),
  };
}

describe("P13-E canonical Purchase on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());
    await db.$connect();
    payments = new PrismaPaymentRepository(db);
    purchases = new PrismaCanonicalPurchaseRepository(db);
    projector = new ProjectCanonicalPurchase(purchases, randomUUID);
  });

  beforeEach(createFixture);
  afterEach(cleanupFixture);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("rejects Purchase before persisted PAID + APPROVED financial authority", async () => {
    await expect(projector.execute(ids.order)).resolves.toEqual({
      state: "INELIGIBLE",
      reason: "FINANCIAL_STATE_NOT_AUTHORITATIVE",
    });

    expect(await db.analyticsEvent.count({ where: { orderId: ids.order } })).toBe(0);
  });

  it("projects authoritative Purchase with commercial, attribution and consent snapshots", async () => {
    await approvePayment();

    const result = await projector.execute(ids.order);
    const order = await db.order.findUniqueOrThrow({
      where: {
        id: ids.order,
      },
    });

    expect(result).toMatchObject({
      state: "CREATED",
      event: {
        type: "PURCHASE",
        occurredAt: order.paidAt,
        journeyId: ids.journey,
        productId: ids.product,
        offerId: ids.offer,
        orderId: ids.order,
        amountMinor: 2990,
        currency: "BRL",
        attributionState: "ATTRIBUTED",
        consentSnapshot: {
          analytics: "GRANTED",
          advertising: "DENIED",
          policyVersion: "p13-architecture-freeze-r2",
        },
        schemaVersion: 1,
        purchaseOrderKey: ids.order,
      },
    });
  });

  it("projects an explicit unattributed Purchase without inventing consent or source", async () => {
    await db.orderAttribution.update({
      where: {
        id: ids.orderAttribution,
      },
      data: {
        journeyId: null,
        firstTouchId: null,
        lastTouchId: null,
        firstSource: null,
        firstMedium: null,
        firstCampaign: null,
        lastSource: null,
        lastMedium: null,
        lastCampaign: null,
      },
    });
    await approvePayment();

    await expect(projector.execute(ids.order)).resolves.toMatchObject({
      state: "CREATED",
      event: {
        journeyId: null,
        attributionState: "UNATTRIBUTED",
        consentSnapshot: {
          analytics: "UNKNOWN",
          advertising: "UNKNOWN",
          policyVersion: "p13-architecture-freeze-r2",
        },
      },
    });
  });

  it("keeps exactly one canonical Purchase across sequential replay", async () => {
    await approvePayment();

    const first = await projector.execute(ids.order);
    const second = await projector.execute(ids.order);

    expect(first.state).toBe("CREATED");
    expect(second.state).toBe("EXISTING");

    if (first.state !== "INELIGIBLE" && second.state !== "INELIGIBLE") {
      expect(second.event.id).toBe(first.event.id);
    }

    expect(
      await db.analyticsEvent.count({
        where: {
          purchaseOrderKey: ids.order,
        },
      }),
    ).toBe(1);
  });

  it("serializes concurrent projection to one CREATED and one EXISTING result", async () => {
    await approvePayment();

    const results = await Promise.all([projector.execute(ids.order), projector.execute(ids.order)]);

    expect(results.map((result) => result.state).sort()).toEqual(["CREATED", "EXISTING"]);
    expect(
      await db.analyticsEvent.count({
        where: {
          purchaseOrderKey: ids.order,
        },
      }),
    ).toBe(1);
  });

  it("reconciles an authoritative paid Order missing Purchase", async () => {
    await approvePayment();

    await expect(purchases.findEligibleMissingOrderIds(50)).resolves.toContain(ids.order);

    const reconciliation = new ReconcileCanonicalPurchases(purchases, projector);

    await expect(reconciliation.execute(50)).resolves.toEqual({
      scanned: 1,
      created: 1,
      existing: 0,
      ineligible: 0,
      failed: 0,
    });

    await expect(reconciliation.execute(50)).resolves.toEqual({
      scanned: 0,
      created: 0,
      existing: 0,
      ineligible: 0,
      failed: 0,
    });
  });

  it("rejects ambiguous multiple APPROVED payments", async () => {
    await approvePayment();

    await db.payment.create({
      data: {
        orderId: ids.order,
        status: "APPROVED",
        amountMinor: 2990,
        currency: "BRL",
        approvedAt: new Date(),
        provider: "MERCADO_PAGO",
        providerOrderId: `ORD${randomUUID().replaceAll("-", "")}`,
        providerPaymentId: `PAY${randomUUID().replaceAll("-", "")}`,
        attemptNumber: 2,
        paymentMethod: "PIX",
        requiresReview: false,
      },
    });

    await expect(projector.execute(ids.order)).resolves.toEqual({
      state: "INELIGIBLE",
      reason: "AMBIGUOUS_APPROVED_PAYMENT",
    });
  });

  it("rejects an APPROVED row without the authoritative P10 operation fingerprint", async () => {
    const approved = await approvePayment();

    await db.payment.update({
      where: {
        id: approved.paymentId,
      },
      data: {
        operationFingerprint: "0".repeat(64),
      },
    });

    await expect(projector.execute(ids.order)).resolves.toEqual({
      state: "INELIGIBLE",
      reason: "FINANCIAL_STATE_NOT_AUTHORITATIVE",
    });
  });

  it("isolates projection failure after the financial transaction commits", async () => {
    const snapshot = approvedSnapshot();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const coordinator = new FinancialCoordinator(payments, provider(snapshot), {
      afterFinancialObservation: async () => {
        throw new Error("TEST_ANALYTICS_FAILURE");
      },
    });

    await expect(coordinator.start(ids.order, "PIX")).resolves.toMatchObject({
      state: "approved",
    });

    await expect(db.order.findUniqueOrThrow({ where: { id: ids.order } })).resolves.toMatchObject({
      status: "PAID",
    });
    await expect(
      db.payment.findFirstOrThrow({ where: { orderId: ids.order } }),
    ).resolves.toMatchObject({
      status: "APPROVED",
    });
    expect(await db.analyticsEvent.count({ where: { orderId: ids.order } })).toBe(0);
    const diagnostic = JSON.parse(String(errorSpy.mock.calls.at(-1)?.[0])) as Record<
      string,
      unknown
    >;
    expect(diagnostic).toMatchObject({
      event: "canonical_purchase_projection_failed",
      surface: "PAYMENTS",
      outcome: "DEGRADED",
      failureCode: "CANONICAL_PURCHASE_PROJECTION_FAILED",
    });

    errorSpy.mockRestore();
  });

  it("projects once through CREATE_RESPONSE and remains unique on webhook replay", async () => {
    const snapshot = approvedSnapshot();
    const observer = new CanonicalPurchaseFinancialObserver(projector);
    const coordinator = new FinancialCoordinator(payments, provider(snapshot), observer);

    await expect(coordinator.start(ids.order, "PIX")).resolves.toMatchObject({
      state: "approved",
    });
    await expect(coordinator.webhook(snapshot.providerOrderId)).resolves.toBe("NOOP");

    expect(
      await db.analyticsEvent.count({
        where: {
          purchaseOrderKey: ids.order,
        },
      }),
    ).toBe(1);
  });
});
