import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { AuthorizeDigitalResource } from "../../modules/entitlements/application/authorize-digital-resource";
import { ListBuyerDigitalResources } from "../../modules/entitlements/application/list-buyer-digital-resources";
import type { BuyerSubject } from "../../modules/entitlements/application/buyer-session";
import { createDatabaseClient } from "./client";
import { PrismaResourceAuthorizationRepository } from "./prisma-resource-authorization-repository";

let db: ReturnType<typeof createDatabaseClient>;

let authorize: AuthorizeDigitalResource;
let listResources: ListBuyerDigitalResources;

type Fixture = {
  customerId: string;
  productId: string;
  offerId: string;
  orderId: string;
  orderItemId: string;
  entitlementId: string;
  resourceId: string;
  credentialId: string;
  extraResourceIds: string[];
};

let fixture: Fixture;

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P11 C4 requires APP_ENV=test and TEST_DATABASE_URL");
  }

  const url = new URL(raw);

  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    !["/lessenc_test", "/lessenc_test_rebuild"].includes(url.pathname) ||
    !url.username ||
    !url.password
  ) {
    throw new Error("P11 C4 refused a non-isolated P06 test database");
  }

  return raw;
}

function subject(): BuyerSubject {
  return Object.freeze({
    customerId: fixture.customerId,
    orderId: fixture.orderId,
    credentialId: fixture.credentialId,
  });
}

async function createFixture() {
  fixture = {
    customerId: randomUUID(),
    productId: randomUUID(),
    offerId: randomUUID(),
    orderId: randomUUID(),
    orderItemId: randomUUID(),
    entitlementId: randomUUID(),
    resourceId: randomUUID(),
    credentialId: randomUUID(),
    extraResourceIds: [],
  };

  await db.customer.create({
    data: {
      id: fixture.customerId,
      email: `${fixture.customerId}@example.invalid`,
    },
  });

  await db.product.create({
    data: {
      id: fixture.productId,
      name: `P11 C4 ${fixture.productId}`,
      status: "ACTIVE",
    },
  });

  await db.offer.create({
    data: {
      id: fixture.offerId,
      productId: fixture.productId,
      priceMinor: 2990,
      currency: "BRL",
      isActive: true,
    },
  });

  await db.order.create({
    data: {
      id: fixture.orderId,
      customerId: fixture.customerId,
      status: "PAID",
      totalMinor: 2990,
      currency: "BRL",
      paidAt: new Date("2026-09-13T10:00:00.000Z"),
    },
  });

  await db.orderItem.create({
    data: {
      id: fixture.orderItemId,
      orderId: fixture.orderId,
      productId: fixture.productId,
      offerId: fixture.offerId,
      productNameSnapshot: `P11 C4 ${fixture.productId}`,
      unitPriceMinor: 2990,
      quantity: 1,
      totalMinor: 2990,
      currency: "BRL",
    },
  });

  await db.entitlement.create({
    data: {
      id: fixture.entitlementId,
      orderItemId: fixture.orderItemId,
      status: "ACTIVE",
      activatedAt: new Date("2026-09-13T10:00:01.000Z"),
    },
  });

  await db.digitalResource.create({
    data: {
      id: fixture.resourceId,
      logicalKey: `p11-c4-${fixture.resourceId}`,
      version: 1,
      storageKey: `resources/${fixture.resourceId}/v1.bin`,
      filename: "lessenc-resource.pdf",
      mediaType: "application/pdf",
      status: "ACTIVE",
    },
  });

  /*
   * Current catalog mapping exists initially,
   * but C4 authorization must never depend on it.
   */
  await db.productDigitalResource.create({
    data: {
      productId: fixture.productId,
      resourceId: fixture.resourceId,
    },
  });

  await db.entitlementDigitalResource.create({
    data: {
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
    },
  });

  await db.buyerAccessCredential.create({
    data: {
      id: fixture.credentialId,
      orderId: fixture.orderId,
      secretHash: "a".repeat(64),
      status: "ACTIVE",
      activeOrderKey: fixture.orderId,
    },
  });
}

async function cleanupFixture() {
  if (!fixture) {
    return;
  }

  await db.digitalDeliveryEvent.deleteMany({
    where: {
      OR: [
        {
          entitlementId: fixture.entitlementId,
        },
        {
          buyerAccessCredentialId: fixture.credentialId,
        },
      ],
    },
  });

  await db.buyerAccessCredential.deleteMany({
    where: {
      orderId: fixture.orderId,
    },
  });

  await db.entitlementDigitalResource.deleteMany({
    where: {
      entitlementId: fixture.entitlementId,
    },
  });

  await db.productDigitalResource.deleteMany({
    where: {
      productId: fixture.productId,
    },
  });

  await db.entitlement.deleteMany({
    where: {
      id: fixture.entitlementId,
    },
  });

  await db.digitalResource.deleteMany({
    where: {
      id: {
        in: [fixture.resourceId, ...fixture.extraResourceIds],
      },
    },
  });

  await db.orderItem.deleteMany({
    where: {
      id: fixture.orderItemId,
    },
  });

  await db.order.deleteMany({
    where: {
      id: fixture.orderId,
    },
  });

  await db.offer.deleteMany({
    where: {
      id: fixture.offerId,
    },
  });

  await db.product.deleteMany({
    where: {
      id: fixture.productId,
    },
  });

  await db.customer.deleteMany({
    where: {
      id: fixture.customerId,
    },
  });
}

describe("P11 C4 resource authorization on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());

    await db.$connect();

    const resourceRepository = new PrismaResourceAuthorizationRepository(db);

    authorize = new AuthorizeDigitalResource(resourceRepository);

    listResources = new ListBuyerDigitalResources(resourceRepository);
  });

  beforeEach(createFixture);

  afterEach(cleanupFixture);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("authorizes an ACTIVE immutable entitlement grant for the owning BuyerSubject", async () => {
    await expect(authorize.execute(subject(), fixture.resourceId)).resolves.toEqual({
      resourceId: fixture.resourceId,
      entitlementId: fixture.entitlementId,
      storageKey: `resources/${fixture.resourceId}/v1.bin`,
      filename: "lessenc-resource.pdf",
      mediaType: "application/pdf",
    });
  });

  it("returns only RESOURCE_NOT_AVAILABLE for a malformed resource identifier", async () => {
    await expect(authorize.execute(subject(), "not-a-resource-id")).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("returns only RESOURCE_NOT_AVAILABLE for an unknown resource", async () => {
    await expect(authorize.execute(subject(), randomUUID())).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("rejects a BuyerSubject whose Customer does not own the Order", async () => {
    await expect(
      authorize.execute(
        {
          ...subject(),
          customerId: randomUUID(),
        },
        fixture.resourceId,
      ),
    ).rejects.toThrow("RESOURCE_NOT_AVAILABLE");
  });

  it("rejects a BuyerSubject scoped to another Order", async () => {
    await expect(
      authorize.execute(
        {
          ...subject(),
          orderId: randomUUID(),
        },
        fixture.resourceId,
      ),
    ).rejects.toThrow("RESOURCE_NOT_AVAILABLE");
  });

  it("rejects authorization after the Buyer Access Credential is revoked", async () => {
    await db.buyerAccessCredential.update({
      where: {
        id: fixture.credentialId,
      },
      data: {
        status: "REVOKED",
        activeOrderKey: null,
        revokedAt: new Date("2026-09-13T11:00:00.000Z"),
      },
    });

    await expect(authorize.execute(subject(), fixture.resourceId)).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("rejects a REVOKED entitlement grant", async () => {
    await db.entitlement.update({
      where: {
        id: fixture.entitlementId,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date("2026-09-13T11:01:00.000Z"),
      },
    });

    await expect(authorize.execute(subject(), fixture.resourceId)).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("rejects an EXPIRED entitlement", async () => {
    await db.entitlement.update({
      where: {
        id: fixture.entitlementId,
      },
      data: {
        status: "EXPIRED",
      },
    });

    await expect(authorize.execute(subject(), fixture.resourceId)).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("rejects an INACTIVE protected DigitalResource", async () => {
    await db.digitalResource.update({
      where: {
        id: fixture.resourceId,
      },
      data: {
        status: "INACTIVE",
      },
    });

    await expect(authorize.execute(subject(), fixture.resourceId)).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("keeps historical authorization after the current ProductDigitalResource mapping is removed", async () => {
    await db.productDigitalResource.deleteMany({
      where: {
        productId: fixture.productId,
        resourceId: fixture.resourceId,
      },
    });

    await expect(authorize.execute(subject(), fixture.resourceId)).resolves.toMatchObject({
      resourceId: fixture.resourceId,
      entitlementId: fixture.entitlementId,
    });
  });

  it("does not revoke historical access merely because the current Product becomes INACTIVE", async () => {
    await db.product.update({
      where: {
        id: fixture.productId,
      },
      data: {
        status: "INACTIVE",
      },
    });

    await expect(authorize.execute(subject(), fixture.resourceId)).resolves.toMatchObject({
      resourceId: fixture.resourceId,
      entitlementId: fixture.entitlementId,
    });
  });

  it("rejects a resource added only to the current catalog when no EntitlementDigitalResource grant exists", async () => {
    const laterResourceId = randomUUID();

    fixture.extraResourceIds.push(laterResourceId);

    await db.digitalResource.create({
      data: {
        id: laterResourceId,
        logicalKey: `p11-c4-later-${laterResourceId}`,
        version: 1,
        storageKey: `resources/${laterResourceId}/v1.bin`,
        filename: "later-resource.pdf",
        mediaType: "application/pdf",
        status: "ACTIVE",
      },
    });

    await db.productDigitalResource.create({
      data: {
        productId: fixture.productId,
        resourceId: laterResourceId,
      },
    });

    await expect(authorize.execute(subject(), laterResourceId)).rejects.toThrow(
      "RESOURCE_NOT_AVAILABLE",
    );
  });

  it("lists only safe metadata for resources granted to the BuyerSubject", async () => {
    const resources = await listResources.execute(subject());

    expect(resources).toEqual([
      {
        resourceId: fixture.resourceId,
        filename: "lessenc-resource.pdf",
        mediaType: "application/pdf",
      },
    ]);

    const serialized = JSON.stringify(resources);

    expect(serialized).not.toContain("storageKey");

    expect(serialized).not.toContain("entitlementId");

    expect(serialized).not.toContain(fixture.credentialId);
  });

  it("keeps the granted resource in the buyer library after current catalog mapping removal", async () => {
    await db.productDigitalResource.deleteMany({
      where: {
        productId: fixture.productId,
        resourceId: fixture.resourceId,
      },
    });

    await expect(listResources.execute(subject())).resolves.toEqual([
      {
        resourceId: fixture.resourceId,
        filename: "lessenc-resource.pdf",
        mediaType: "application/pdf",
      },
    ]);
  });

  it("does not list a resource that exists only in the current catalog", async () => {
    const laterResourceId = randomUUID();

    fixture.extraResourceIds.push(laterResourceId);

    await db.digitalResource.create({
      data: {
        id: laterResourceId,
        logicalKey: `p11-c4-library-${laterResourceId}`,
        version: 1,
        storageKey: `resources/${laterResourceId}/v1.bin`,
        filename: "later-library.pdf",
        mediaType: "application/pdf",
        status: "ACTIVE",
      },
    });

    await db.productDigitalResource.create({
      data: {
        productId: fixture.productId,
        resourceId: laterResourceId,
      },
    });

    const resources = await listResources.execute(subject());

    expect(resources.map((entry) => entry.resourceId)).toEqual([fixture.resourceId]);
  });

  it("removes an INACTIVE DigitalResource from the buyer library", async () => {
    await db.digitalResource.update({
      where: {
        id: fixture.resourceId,
      },
      data: {
        status: "INACTIVE",
      },
    });

    await expect(listResources.execute(subject())).resolves.toEqual([]);
  });

  it("returns no library resources after the Entitlement is revoked", async () => {
    await db.entitlement.update({
      where: {
        id: fixture.entitlementId,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date("2026-09-13T11:30:00.000Z"),
      },
    });

    await expect(listResources.execute(subject())).resolves.toEqual([]);
  });
});
