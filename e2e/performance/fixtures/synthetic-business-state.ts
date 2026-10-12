import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { getDatabaseClient } from "../../../src/infrastructure/database/client";
import { HmacBuyerSession } from "../../../src/infrastructure/security/hmac-buyer-session";
import { HmacPaymentContinuation } from "../../../src/infrastructure/security/hmac-payment-continuation";
import {
  assertNoExternalServiceEnvironment,
  assertPerformanceStorage,
  validatePerformanceDatabaseUrl,
} from "../helpers/isolation";

export const PERFORMANCE_PRODUCT_ID = "17000000-0000-4000-8000-000000000101";
export const PERFORMANCE_OFFER_ID = "17000000-0000-4000-8000-000000000102";
export const PERFORMANCE_RESOURCE_ID = "17000000-0000-4000-8000-000000000103";
const PERFORMANCE_STORAGE_KEY = "p17-performance/protected-delivery.zip";
const EMPTY_ZIP_ARCHIVE = Buffer.from("UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA==", "base64");
const syntheticCheckoutEmail =
  /^p17\.performance\.inp\.(mobile|tablet|desktop)\.([1-9]|[1-3][0-9]|4[0-3])@example\.invalid$/u;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

export type PendingPaymentFixture = Readonly<{
  customerId: string;
  orderId: string;
  orderItemId: string;
  paymentCookie: string;
}>;

export type ProtectedDeliveryFixture = Readonly<{
  customerId: string;
  orderId: string;
  orderItemId: string;
  entitlementId: string;
  credentialId: string;
  resourceId: typeof PERFORMANCE_RESOURCE_ID;
  buyerCookie: string;
  resourcePath: string;
}>;

function database() {
  validatePerformanceDatabaseUrl(process.env.DB_RUNTIME_URL);
  assertNoExternalServiceEnvironment(process.env);
  return getDatabaseClient();
}

function storageRoot(): string {
  return assertPerformanceStorage({
    driver: process.env.PRIVATE_STORAGE_DRIVER,
    path: process.env.PRIVATE_FILE_STORAGE_PATH,
    repositoryRoot: process.cwd(),
  });
}

export function assertSyntheticAttemptNumber(attempt: number): number {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || attempt > 43) {
    throw new Error("P17_PERFORMANCE_FIXTURE_ATTEMPT_INVALID");
  }
  return attempt;
}

export function createSyntheticCheckoutEmail(
  viewport: "mobile" | "tablet" | "desktop",
  attempt: number,
): string {
  return `p17.performance.inp.${viewport}.${assertSyntheticAttemptNumber(attempt)}@example.invalid`;
}

export function assertSyntheticCheckoutEmail(email: string): void {
  if (!syntheticCheckoutEmail.test(email)) {
    throw new Error("P17_PERFORMANCE_FIXTURE_EMAIL_INVALID");
  }
}

function assertSyntheticOrderIdentity(input: {
  customerId: string;
  orderId: string;
  orderItemId: string;
  entitlementId?: string;
  credentialId?: string;
}): void {
  for (const value of [
    input.customerId,
    input.orderId,
    input.orderItemId,
    input.entitlementId,
    input.credentialId,
  ]) {
    if (value !== undefined && !uuid.test(value)) {
      throw new Error("P17_PERFORMANCE_FIXTURE_IDENTITY_INVALID");
    }
  }
}

export async function prepareSyntheticPerformanceCatalog(): Promise<void> {
  const db = database();
  const resourcePath = join(storageRoot(), ...PERFORMANCE_STORAGE_KEY.split("/"));

  await mkdir(dirname(resourcePath), { recursive: true, mode: 0o700 });
  await writeFile(resourcePath, EMPTY_ZIP_ARCHIVE, { mode: 0o600 });

  try {
    await db.$transaction(async (tx) => {
      await tx.product.upsert({
        where: { id: PERFORMANCE_PRODUCT_ID },
        create: {
          id: PERFORMANCE_PRODUCT_ID,
          name: "Cronograma Capilar Inteligente",
          description: "Fixture sintética e descartável de performance P17.",
          status: "ACTIVE",
        },
        update: {
          name: "Cronograma Capilar Inteligente",
          description: "Fixture sintética e descartável de performance P17.",
          status: "ACTIVE",
        },
      });

      await tx.offer.upsert({
        where: { id: PERFORMANCE_OFFER_ID },
        create: {
          id: PERFORMANCE_OFFER_ID,
          productId: PERFORMANCE_PRODUCT_ID,
          priceMinor: 2_990,
          currency: "BRL",
          isActive: true,
        },
        update: {
          productId: PERFORMANCE_PRODUCT_ID,
          priceMinor: 2_990,
          currency: "BRL",
          isActive: true,
        },
      });

      await tx.digitalResource.upsert({
        where: { id: PERFORMANCE_RESOURCE_ID },
        create: {
          id: PERFORMANCE_RESOURCE_ID,
          logicalKey: "p17-performance-protected-delivery",
          version: 1,
          storageKey: PERFORMANCE_STORAGE_KEY,
          filename: "p17-performance-protected-delivery.zip",
          mediaType: "application/zip",
          status: "ACTIVE",
        },
        update: {
          storageKey: PERFORMANCE_STORAGE_KEY,
          filename: "p17-performance-protected-delivery.zip",
          mediaType: "application/zip",
          status: "ACTIVE",
        },
      });

      await tx.productDigitalResource.upsert({
        where: {
          productId_resourceId: {
            productId: PERFORMANCE_PRODUCT_ID,
            resourceId: PERFORMANCE_RESOURCE_ID,
          },
        },
        create: {
          productId: PERFORMANCE_PRODUCT_ID,
          resourceId: PERFORMANCE_RESOURCE_ID,
        },
        update: {},
      });
    });
  } catch (error) {
    await rm(resourcePath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function createPendingPaymentFixture(attempt: number): Promise<PendingPaymentFixture> {
  assertSyntheticAttemptNumber(attempt);
  const secret = process.env.P10_PAYMENT_CONTINUATION_SECRET;
  if (!secret) throw new Error("P17_PERFORMANCE_PAYMENT_SESSION_SECRET_MISSING");
  const paymentSession = new HmacPaymentContinuation(secret);

  const db = database();
  const customerId = randomUUID();
  const orderId = randomUUID();
  const orderItemId = randomUUID();

  await db.$transaction(async (tx) => {
    await tx.customer.create({
      data: {
        id: customerId,
        email: `p17.performance.payment.${attempt}.${customerId}@example.invalid`,
      },
    });
    await tx.order.create({
      data: {
        id: orderId,
        customerId,
        status: "PENDING",
        totalMinor: 2_990,
        currency: "BRL",
      },
    });
    await tx.orderItem.create({
      data: {
        id: orderItemId,
        orderId,
        productId: PERFORMANCE_PRODUCT_ID,
        offerId: PERFORMANCE_OFFER_ID,
        productNameSnapshot: "Cronograma Capilar Inteligente",
        productDescriptionSnapshot: "Fixture sintética e descartável de performance P17.",
        unitPriceMinor: 2_990,
        quantity: 1,
        totalMinor: 2_990,
        currency: "BRL",
      },
    });
  });

  return Object.freeze({
    customerId,
    orderId,
    orderItemId,
    paymentCookie: paymentSession.issue(orderId),
  });
}

export async function createProtectedDeliveryFixture(
  attempt: number,
): Promise<ProtectedDeliveryFixture> {
  assertSyntheticAttemptNumber(attempt);
  const secret = process.env.P11_BUYER_SESSION_SECRET;
  if (!secret) throw new Error("P17_PERFORMANCE_BUYER_SESSION_SECRET_MISSING");
  const buyerSession = new HmacBuyerSession(secret);

  const db = database();
  const customerId = randomUUID();
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  const entitlementId = randomUUID();
  const credentialId = randomUUID();
  const now = new Date();

  await db.$transaction(async (tx) => {
    await tx.customer.create({
      data: {
        id: customerId,
        email: `p17.performance.delivery.${attempt}.${customerId}@example.invalid`,
      },
    });
    await tx.order.create({
      data: {
        id: orderId,
        customerId,
        status: "PAID",
        totalMinor: 2_990,
        currency: "BRL",
        paidAt: now,
      },
    });
    await tx.orderItem.create({
      data: {
        id: orderItemId,
        orderId,
        productId: PERFORMANCE_PRODUCT_ID,
        offerId: PERFORMANCE_OFFER_ID,
        productNameSnapshot: "Cronograma Capilar Inteligente",
        productDescriptionSnapshot: "Fixture sintética e descartável de performance P17.",
        unitPriceMinor: 2_990,
        quantity: 1,
        totalMinor: 2_990,
        currency: "BRL",
      },
    });
    await tx.entitlement.create({
      data: {
        id: entitlementId,
        orderItemId,
        status: "ACTIVE",
        activatedAt: now,
      },
    });
    await tx.entitlementDigitalResource.create({
      data: {
        entitlementId,
        resourceId: PERFORMANCE_RESOURCE_ID,
      },
    });
    await tx.buyerAccessCredential.create({
      data: {
        id: credentialId,
        orderId,
        secretHash: createHash("sha256")
          .update(`p17-performance-${credentialId}`, "utf8")
          .digest("hex"),
        status: "ACTIVE",
        activeOrderKey: orderId,
      },
    });
  });

  const buyerCookie = buyerSession.issue({ customerId, orderId, credentialId });

  return Object.freeze({
    customerId,
    orderId,
    orderItemId,
    entitlementId,
    credentialId,
    resourceId: PERFORMANCE_RESOURCE_ID,
    buyerCookie,
    resourcePath: `/api/buyer-access/resources/${PERFORMANCE_RESOURCE_ID}`,
  });
}

/**
 * Reads only the disposable local performance database.
 *
 * A valid protected delivery must persist exactly one event
 * for this unique synthetic buyer credential. This function
 * neither creates nor changes audit rows.
 *
 * It is intentionally called only after the HTTP body and
 * browser timing have been observed.
 */
export async function hasExactSuccessfulProtectedDeliveryAudit(
  fixture: ProtectedDeliveryFixture,
): Promise<boolean> {
  const db = database();

  const records = await db.digitalDeliveryEvent.findMany({
    where: {
      buyerAccessCredentialId: fixture.credentialId,
    },
    select: {
      entitlementId: true,
      resourceId: true,
      outcome: true,
      failureCode: true,
    },
  });

  if (records.length !== 1) {
    return false;
  }

  const record = records[0];

  return (
    record !== undefined &&
    record.entitlementId === fixture.entitlementId &&
    record.resourceId === fixture.resourceId &&
    record.outcome === "SUCCEEDED" &&
    record.failureCode === null
  );
}
export async function cleanupSyntheticOrder(
  input: Readonly<{
    customerId: string;
    orderId: string;
    orderItemId: string;
    entitlementId?: string;
    credentialId?: string;
  }>,
): Promise<void> {
  assertSyntheticOrderIdentity(input);
  const db = database();

  await db.$transaction(async (tx) => {
    if (input.credentialId) {
      await tx.digitalDeliveryEvent.deleteMany({
        where: { buyerAccessCredentialId: input.credentialId },
      });
    }
    if (input.entitlementId) {
      await tx.entitlementDigitalResource.deleteMany({
        where: { entitlementId: input.entitlementId },
      });
      await tx.entitlement.deleteMany({ where: { id: input.entitlementId } });
    }
    if (input.credentialId) {
      await tx.buyerAccessCredential.deleteMany({ where: { id: input.credentialId } });
    }
    await tx.paymentEvent.deleteMany({ where: { payment: { orderId: input.orderId } } });
    await tx.payment.deleteMany({ where: { orderId: input.orderId } });
    await tx.orderAttribution.deleteMany({ where: { orderId: input.orderId } });
    await tx.orderItem.deleteMany({ where: { id: input.orderItemId } });
    await tx.order.deleteMany({ where: { id: input.orderId } });
    await tx.customer.deleteMany({ where: { id: input.customerId } });
  });
}

export async function cleanupCheckoutAttempt(email: string): Promise<void> {
  assertSyntheticCheckoutEmail(email);
  const db = database();
  const customers = await db.customer.findMany({
    where: { email },
    select: { id: true, orders: { select: { id: true, items: { select: { id: true } } } } },
  });

  for (const customer of customers) {
    for (const order of customer.orders) {
      await cleanupSyntheticOrder({
        customerId: customer.id,
        orderId: order.id,
        orderItemId: order.items[0]?.id ?? "00000000-0000-4000-8000-000000000000",
      });
    }
  }
}

export async function cleanupSyntheticPerformanceCatalog(): Promise<void> {
  const db = database();
  const resourcePath = join(storageRoot(), ...PERFORMANCE_STORAGE_KEY.split("/"));

  await db.$transaction(async (tx) => {
    await tx.buyerAccessRateLimitBucket.deleteMany({
      where: { scope: "DOWNLOAD_CREDENTIAL" },
    });
    await tx.productDigitalResource.deleteMany({
      where: { productId: PERFORMANCE_PRODUCT_ID, resourceId: PERFORMANCE_RESOURCE_ID },
    });
    await tx.digitalResource.deleteMany({ where: { id: PERFORMANCE_RESOURCE_ID } });
    await tx.analyticsDispatch.deleteMany({
      where: { analyticsEvent: { productId: PERFORMANCE_PRODUCT_ID } },
    });
    await tx.analyticsEvent.deleteMany({ where: { productId: PERFORMANCE_PRODUCT_ID } });
    // The URL guard above proves this is the dedicated disposable performance database.
    // Acquisition rows have no fixture discriminator, so complete cleanup is safe only here.
    await tx.attributionTouch.deleteMany();
    await tx.acquisitionJourney.deleteMany();
    await tx.offer.deleteMany({ where: { id: PERFORMANCE_OFFER_ID } });
    await tx.product.deleteMany({ where: { id: PERFORMANCE_PRODUCT_ID } });
  });

  await rm(resourcePath, { force: true });
}
