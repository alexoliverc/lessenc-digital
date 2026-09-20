import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buyerAccessCookieName } from "../../app/api/buyer-access/http";
import { createProtectedDownloadHandler } from "../../app/api/buyer-access/resources/[resourceId]/handler";
import { ResolvePurchasableOffer } from "../../modules/catalog/application/resolve-purchasable-offer";
import { CreateCheckoutOrder } from "../../modules/commerce/application/create-checkout-order";
import { PrepareOrder } from "../../modules/commerce/application/prepare-order";
import { AuthorizeDigitalResource } from "../../modules/entitlements/application/authorize-digital-resource";
import { ExchangeBuyerAccessCredential } from "../../modules/entitlements/application/exchange-buyer-access-credential";
import { IssueBuyerAccessCredential } from "../../modules/entitlements/application/issue-buyer-access-credential";
import {
  PrepareProtectedDelivery,
  RecordProtectedDeliveryOutcome,
} from "../../modules/entitlements/application/protected-digital-delivery";
import { ProcessEntitlementGrant } from "../../modules/entitlements/application/process-entitlement-grant";
import { ValidateBuyerSession } from "../../modules/entitlements/application/validate-buyer-session";
import type { ProviderSnapshot } from "../../modules/payments/application/payment-provider";
import { SystemClock } from "../../shared/clock";
import { HmacBuyerSession } from "../security/hmac-buyer-session";
import { OpaqueBuyerAccessCredentialService } from "../security/opaque-buyer-access-credential";
import { LocalPrivateFileStorage } from "../storage/local-private-file-storage";
import { createDatabaseClient } from "./client";
import { PrismaBuyerAccessCredentialRepository } from "./prisma-buyer-access-credential-repository";
import { PrismaCatalogRepository } from "./prisma-catalog-repository";
import { PrismaCheckoutOrderRepository } from "./prisma-checkout-order-repository";
import { PrismaDigitalDeliveryAuditRepository } from "./prisma-digital-delivery-audit-repository";
import { PrismaEntitlementGrantRepository } from "./prisma-entitlement-grant-repository";
import { PrismaPaymentRepository } from "./prisma-payment-repository";
import { PrismaResourceAuthorizationRepository } from "./prisma-resource-authorization-repository";

const SESSION_SECRET = "gate-b-buyer-session-secret-at-least-32-bytes-long";

const PRICE_MINOR = 2990;

const EMAIL = `gate-b-${randomUUID()}@example.invalid`;

const PRODUCT_ID = randomUUID();

const OFFER_ID = randomUUID();

const RESOURCE_ID = randomUUID();

const ORDER_ID = randomUUID();

const ITEM_ID = randomUUID();

const CUSTOMER_ID = randomUUID();

const RETRY_CUSTOMER_ID = randomUUID();

const RETRY_ITEM_ID = randomUUID();

const STORAGE_KEY = `gate-b/${RESOURCE_ID}.pdf`;

const RESOURCE_CONTENT = "L'Essenc Gate B protected commerce-core fixture.";

let db: ReturnType<typeof createDatabaseClient>;

let privateRoot = "";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("Gate B requires APP_ENV=test and TEST_DATABASE_URL");
  }

  const url = new URL(raw);

  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    !["/lessenc_test", "/lessenc_test_rebuild"].includes(url.pathname) ||
    !url.username ||
    !url.password
  ) {
    throw new Error("Gate B refused a non-isolated P06 test database");
  }

  return raw;
}

function approvedSnapshot(): ProviderSnapshot {
  return Object.freeze({
    providerOrderId: `ORD${randomUUID().replaceAll("-", "")}`,
    providerPaymentId: `PAY${randomUUID().replaceAll("-", "")}`,
    providerAccountId: null,
    externalReference: ORDER_ID,
    amountMinor: PRICE_MINOR,
    paymentAmountMinor: PRICE_MINOR,
    currency: "BRL",
    paymentMethod: "PIX",
    paidAmountMinor: PRICE_MINOR,
    refundedAmountMinor: null,
    status: "APPROVED",
    requiresReview: false,
    reviewReason: null,
    providerStatus: "processed",
    providerStatusDetail: "accredited",
    occurredAt: "2026-09-13T22:00:00Z",
    createdAt: "2026-09-13T21:59:00Z",
    presentation: null,
  });
}

async function cleanup(): Promise<void> {
  if (!db) {
    return;
  }

  const entitlements = await db.entitlement.findMany({
    where: {
      orderItemId: {
        in: [ITEM_ID, RETRY_ITEM_ID],
      },
    },
    select: {
      id: true,
    },
  });

  const entitlementIds = entitlements.map(({ id }) => id);

  if (entitlementIds.length > 0) {
    await db.digitalDeliveryEvent.deleteMany({
      where: {
        entitlementId: {
          in: entitlementIds,
        },
      },
    });

    await db.entitlementDigitalResource.deleteMany({
      where: {
        entitlementId: {
          in: entitlementIds,
        },
      },
    });
  }

  await db.buyerAccessCredential.deleteMany({
    where: {
      orderId: ORDER_ID,
    },
  });

  if (entitlementIds.length > 0) {
    await db.entitlement.deleteMany({
      where: {
        id: {
          in: entitlementIds,
        },
      },
    });
  }

  await db.productDigitalResource.deleteMany({
    where: {
      productId: PRODUCT_ID,
    },
  });

  await db.digitalResource.deleteMany({
    where: {
      id: RESOURCE_ID,
    },
  });

  await db.outboxEvent.deleteMany({
    where: {
      orderId: ORDER_ID,
    },
  });

  await db.paymentEvent.deleteMany({
    where: {
      payment: {
        orderId: ORDER_ID,
      },
    },
  });

  await db.payment.deleteMany({
    where: {
      orderId: ORDER_ID,
    },
  });

  await db.orderItem.deleteMany({
    where: {
      id: {
        in: [ITEM_ID, RETRY_ITEM_ID],
      },
    },
  });

  await db.order.deleteMany({
    where: {
      id: ORDER_ID,
    },
  });

  await db.customer.deleteMany({
    where: {
      id: {
        in: [CUSTOMER_ID, RETRY_CUSTOMER_ID],
      },
    },
  });

  await db.offer.deleteMany({
    where: {
      id: OFFER_ID,
    },
  });

  await db.product.deleteMany({
    where: {
      id: PRODUCT_ID,
    },
  });
}

describe("Gate B commerce core on isolated MySQL", () => {
  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/p06-db-guard.mjs", "test"], {
      stdio: "pipe",
    });

    db = createDatabaseClient(guardedTestUrl());

    await db.$connect();

    privateRoot = await mkdtemp(join(tmpdir(), "lessenc-gate-b-"));

    await db.product.create({
      data: {
        id: PRODUCT_ID,
        name: "Gate B Commerce Core",
        description: "Canonical Gate B integration fixture",
        status: "ACTIVE",
        offers: {
          create: {
            id: OFFER_ID,
            priceMinor: PRICE_MINOR,
            currency: "BRL",
            isActive: true,
          },
        },
      },
    });

    await db.digitalResource.create({
      data: {
        id: RESOURCE_ID,
        logicalKey: `gate-b-${RESOURCE_ID}`,
        version: 1,
        storageKey: STORAGE_KEY,
        filename: "gate-b.pdf",
        mediaType: "application/pdf",
        status: "ACTIVE",
      },
    });

    await db.productDigitalResource.create({
      data: {
        productId: PRODUCT_ID,
        resourceId: RESOURCE_ID,
      },
    });

    const physicalPath = resolve(privateRoot, STORAGE_KEY);

    await mkdir(dirname(physicalPath), {
      recursive: true,
    });

    await writeFile(physicalPath, RESOURCE_CONTENT, "utf8");
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      if (privateRoot) {
        await rm(privateRoot, {
          recursive: true,
          force: true,
        });
      }

      await db?.$disconnect();
    }
  });

  it("completes Order -> Payment -> Entitlement -> protected Delivery safely, reliably and auditably", async () => {
    /*
     * ----------------------------------------------------
     * P09 — real catalog/order application path
     * ----------------------------------------------------
     */

    const resolveOffer = new ResolvePurchasableOffer(new PrismaCatalogRepository(db));

    const prepareOrder = new PrepareOrder(resolveOffer, new SystemClock());

    const createOrder = new CreateCheckoutOrder(
      prepareOrder,
      new PrismaCheckoutOrderRepository(db),
    );

    const checkoutInput = Object.freeze({
      orderId: ORDER_ID,
      itemId: ITEM_ID,
      customerId: CUSTOMER_ID,
      productId: PRODUCT_ID,
      offerId: OFFER_ID,
      email: EMAIL,
      presentedAmountMinor: PRICE_MINOR,
      presentedCurrency: "BRL",
    });

    const created = await createOrder.execute(checkoutInput);

    expect(created.ok).toBe(true);

    if (!created.ok) {
      throw created.error;
    }

    expect(created.value).toEqual({
      state: "CREATED",
    });

    const pendingOrder = await db.order.findUniqueOrThrow({
      where: {
        id: ORDER_ID,
      },
      include: {
        customer: true,
        items: true,
      },
    });

    expect(pendingOrder.status).toBe("PENDING");

    expect(pendingOrder.paidAt).toBeNull();

    expect(pendingOrder.totalMinor).toBe(PRICE_MINOR);

    expect(pendingOrder.currency).toBe("BRL");

    expect(pendingOrder.customer).toMatchObject({
      id: CUSTOMER_ID,
      email: EMAIL,
    });

    expect(pendingOrder.items).toHaveLength(1);

    expect(pendingOrder.items[0]).toMatchObject({
      id: ITEM_ID,
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      offerId: OFFER_ID,
      unitPriceMinor: PRICE_MINOR,
      quantity: 1,
      totalMinor: PRICE_MINOR,
      currency: "BRL",
    });

    /*
     * Same logical checkout is safe to replay.
     */

    const retryCheckoutInput = Object.freeze({
      ...checkoutInput,
      customerId: RETRY_CUSTOMER_ID,
      itemId: RETRY_ITEM_ID,
    });

    expect(retryCheckoutInput.orderId).toBe(checkoutInput.orderId);

    expect(retryCheckoutInput.customerId).not.toBe(checkoutInput.customerId);

    expect(retryCheckoutInput.itemId).not.toBe(checkoutInput.itemId);

    const replayedCheckout = await createOrder.execute(retryCheckoutInput);

    expect(replayedCheckout.ok).toBe(true);

    if (!replayedCheckout.ok) {
      throw replayedCheckout.error;
    }

    expect(replayedCheckout.value).toEqual({
      state: "EXISTING",
    });

    expect(
      await db.customer.count({
        where: {
          id: {
            in: [CUSTOMER_ID, RETRY_CUSTOMER_ID],
          },
        },
      }),
    ).toBe(1);

    expect(
      await db.customer.count({
        where: {
          id: RETRY_CUSTOMER_ID,
        },
      }),
    ).toBe(0);

    expect(
      await db.order.count({
        where: {
          id: ORDER_ID,
        },
      }),
    ).toBe(1);

    expect(
      await db.orderItem.count({
        where: {
          orderId: ORDER_ID,
        },
      }),
    ).toBe(1);

    expect(
      await db.orderItem.count({
        where: {
          id: RETRY_ITEM_ID,
        },
      }),
    ).toBe(0);

    expect(
      await db.payment.count({
        where: {
          orderId: ORDER_ID,
        },
      }),
    ).toBe(0);

    expect(
      await db.entitlement.count({
        where: {
          orderItemId: ITEM_ID,
        },
      }),
    ).toBe(0);

    /*
     * ----------------------------------------------------
     * P10 — real payment persistence path
     * ----------------------------------------------------
     */

    const paymentRepository = new PrismaPaymentRepository(db);

    const reserved = await paymentRepository.reserve(ORDER_ID, "PIX");

    expect(reserved.send).toBe(true);

    expect(reserved.attempt.orderId).toBe(ORDER_ID);

    expect(
      await db.payment.count({
        where: {
          orderId: ORDER_ID,
        },
      }),
    ).toBe(1);

    const observation = approvedSnapshot();

    expect(
      await paymentRepository.applyObservation({
        paymentId: reserved.attempt.paymentId,
        snapshot: observation,
        source: "CREATE_RESPONSE",
      }),
    ).toBe("APPLIED");

    /*
     * Equivalent authenticated provider observation
     * must be a financial NOOP.
     */

    expect(
      await paymentRepository.applyObservation({
        paymentId: reserved.attempt.paymentId,
        snapshot: observation,
        source: "WEBHOOK",
      }),
    ).toBe("NOOP");

    const approvedPayment = await db.payment.findUniqueOrThrow({
      where: {
        id: reserved.attempt.paymentId,
      },
    });

    expect(approvedPayment.status).toBe("APPROVED");

    expect(approvedPayment.approvedAt).toBeInstanceOf(Date);

    const paidOrder = await db.order.findUniqueOrThrow({
      where: {
        id: ORDER_ID,
      },
    });

    expect(paidOrder.status).toBe("PAID");

    expect(paidOrder.paidAt).toBeInstanceOf(Date);

    expect(
      await db.paymentEvent.count({
        where: {
          paymentId: reserved.attempt.paymentId,
        },
      }),
    ).toBe(1);

    const approvalEvents = await db.outboxEvent.findMany({
      where: {
        orderId: ORDER_ID,
        type: "PAYMENT_APPROVED",
      },
    });

    expect(approvalEvents).toHaveLength(1);

    const approvalEvent = approvalEvents[0];

    if (!approvalEvent) {
      throw new Error("GATE_B_PAYMENT_APPROVED_EVENT_MISSING");
    }

    expect(approvalEvent.status).toBe("PENDING");

    expect(approvalEvent.payload).toEqual({
      version: 1,
      orderId: ORDER_ID,
      paymentId: reserved.attempt.paymentId,
    });

    expect(approvalEvent.deduplicationKey).toBe(`payment-approved:${reserved.attempt.paymentId}`);

    /*
     * ----------------------------------------------------
     * P11 — entitlement grant
     * ----------------------------------------------------
     */

    const entitlementGrant = new ProcessEntitlementGrant(new PrismaEntitlementGrantRepository(db));

    expect(await entitlementGrant.execute(approvalEvent.id)).toBe("PROCESSED");

    expect(await entitlementGrant.execute(approvalEvent.id)).toBe("NOOP");

    const processedApproval = await db.outboxEvent.findUniqueOrThrow({
      where: {
        id: approvalEvent.id,
      },
    });

    expect(processedApproval.status).toBe("PROCESSED");

    expect(processedApproval.processedAt).toBeInstanceOf(Date);

    const entitlement = await db.entitlement.findUniqueOrThrow({
      where: {
        orderItemId: ITEM_ID,
      },
      include: {
        resources: true,
      },
    });

    expect(entitlement.status).toBe("ACTIVE");

    expect(entitlement.sourceOutboxEventId).toBe(approvalEvent.id);

    expect(entitlement.resources).toHaveLength(1);

    expect(entitlement.resources[0]).toMatchObject({
      entitlementId: entitlement.id,
      resourceId: RESOURCE_ID,
    });

    /*
     * ----------------------------------------------------
     * P11 — Buyer Access
     * ----------------------------------------------------
     */

    const credentialRepository = new PrismaBuyerAccessCredentialRepository(db);

    const credentialService = new OpaqueBuyerAccessCredentialService();

    const issueCredential = new IssueBuyerAccessCredential(credentialRepository, credentialService);

    const issued = await issueCredential.execute(ORDER_ID);

    expect(issued.orderId).toBe(ORDER_ID);

    expect(issued.rawCredential).toMatch(/^lba_[A-Za-z0-9_-]{43}$/u);

    const persistedCredential = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(persistedCredential.status).toBe("ACTIVE");

    expect(persistedCredential.activeOrderKey).toBe(ORDER_ID);

    expect(persistedCredential.secretHash).not.toBe(issued.rawCredential);

    expect(JSON.stringify(persistedCredential)).not.toContain(issued.rawCredential);

    const sessionService = new HmacBuyerSession(SESSION_SECRET);

    const exchangeCredential = new ExchangeBuyerAccessCredential(
      credentialRepository,
      credentialService,
      sessionService,
    );

    const exchanged = await exchangeCredential.execute(issued.rawCredential);

    expect(exchanged.sessionToken.startsWith("v1.")).toBe(true);

    const cryptographicSession = sessionService.verify(exchanged.sessionToken);

    expect(cryptographicSession).toMatchObject({
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: issued.credentialId,
      purpose: "BUYER_SESSION",
      version: 1,
    });

    const validateSession = new ValidateBuyerSession(credentialRepository, sessionService);

    const subject = await validateSession.execute(exchanged.sessionToken);

    expect(subject).toEqual({
      customerId: CUSTOMER_ID,
      orderId: ORDER_ID,
      credentialId: issued.credentialId,
    });

    /*
     * ----------------------------------------------------
     * P11 — resource authorization
     * ----------------------------------------------------
     */

    const authorization = new AuthorizeDigitalResource(
      new PrismaResourceAuthorizationRepository(db),
    );

    const authorized = await authorization.execute(subject, RESOURCE_ID);

    expect(authorized).toMatchObject({
      entitlementId: entitlement.id,
      resourceId: RESOURCE_ID,
      storageKey: STORAGE_KEY,
      filename: "gate-b.pdf",
      mediaType: "application/pdf",
    });

    /*
     * ----------------------------------------------------
     * P11 — real private storage + HTTP delivery
     * ----------------------------------------------------
     */

    const audit = new PrismaDigitalDeliveryAuditRepository(db);

    const storage = new LocalPrivateFileStorage(privateRoot);

    const prepareDelivery = new PrepareProtectedDelivery(authorization, storage, audit);

    const recordOutcome = new RecordProtectedDeliveryOutcome(audit);

    const handler = createProtectedDownloadHandler({
      validateSession,
      prepareDelivery,
      recordOutcome,
      appEnv: "local",
    });

    const cookieName = buyerAccessCookieName("local");

    const requestHeaders = new Headers();

    requestHeaders.set("cookie", `${cookieName}=${exchanged.sessionToken}`);

    const request = new NextRequest(`http://localhost/api/buyer-access/resources/${RESOURCE_ID}`, {
      method: "GET",
      headers: requestHeaders,
    });

    const response = await handler(request, RESOURCE_ID);

    expect(response.status).toBe(200);

    expect(response.headers.get("content-type")).toContain("application/pdf");

    expect(response.headers.get("accept-ranges")).toBe("none");

    const responseBytes = await response.arrayBuffer();

    expect(Buffer.from(responseBytes).toString("utf8")).toBe(RESOURCE_CONTENT);

    /*
     * SUCCEEDED must exist only after body consumption.
     */

    const deliveryEvents = await db.digitalDeliveryEvent.findMany({
      where: {
        entitlementId: entitlement.id,
        resourceId: RESOURCE_ID,
        buyerAccessCredentialId: issued.credentialId,
      },
    });

    expect(deliveryEvents).toHaveLength(1);

    expect(deliveryEvents[0]).toMatchObject({
      entitlementId: entitlement.id,
      resourceId: RESOURCE_ID,
      buyerAccessCredentialId: issued.credentialId,
      outcome: "SUCCEEDED",
      failureCode: null,
    });

    /*
     * Final commercial invariants.
     */

    expect(
      await db.payment.count({
        where: {
          orderId: ORDER_ID,
        },
      }),
    ).toBe(1);

    expect(
      await db.entitlement.count({
        where: {
          orderItemId: ITEM_ID,
        },
      }),
    ).toBe(1);

    expect(
      await db.entitlementDigitalResource.count({
        where: {
          entitlementId: entitlement.id,
          resourceId: RESOURCE_ID,
        },
      }),
    ).toBe(1);

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: ORDER_ID,
          status: "ACTIVE",
        },
      }),
    ).toBe(1);
  });
});
