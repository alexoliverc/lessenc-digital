import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ExchangeBuyerAccessCredential } from "../../modules/entitlements/application/exchange-buyer-access-credential";
import { ValidateBuyerSession } from "../../modules/entitlements/application/validate-buyer-session";
import { IssueBuyerAccessCredential } from "../../modules/entitlements/application/issue-buyer-access-credential";
import {
  ReissueBuyerAccessCredential,
  RevokeBuyerAccessCredential,
} from "../../modules/entitlements/application/manage-buyer-access-credential";
import { HmacBuyerSession } from "../security/hmac-buyer-session";
import { OpaqueBuyerAccessCredentialService } from "../security/opaque-buyer-access-credential";
import { createDatabaseClient } from "./client";
import { PrismaBuyerAccessCredentialRepository } from "./prisma-buyer-access-credential-repository";

let db: ReturnType<typeof createDatabaseClient>;
let repository: PrismaBuyerAccessCredentialRepository;
let useCase: IssueBuyerAccessCredential;
let revokeUseCase: RevokeBuyerAccessCredential;
let reissueUseCase: ReissueBuyerAccessCredential;

type Fixture = {
  customerId: string;
  productId: string;
  offerId: string;
  orderId: string;
  itemId: string;
  entitlementId: string;
  resourceId: string;
};

let fixture: Fixture;

const EXCHANGE_SESSION_SECRET = "p11-exchange-session-secret-32-bytes-minimum-value";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;

  if (process.env.APP_ENV !== "test" || !raw) {
    throw new Error("P11 buyer access requires APP_ENV=test and TEST_DATABASE_URL");
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
    throw new Error("P11 buyer access refused a non-isolated P06 test database");
  }

  return raw;
}

async function createFixture(): Promise<void> {
  fixture = {
    customerId: randomUUID(),
    productId: randomUUID(),
    offerId: randomUUID(),
    orderId: randomUUID(),
    itemId: randomUUID(),
    entitlementId: randomUUID(),
    resourceId: randomUUID(),
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
      name: `P11 buyer access ${fixture.productId}`,
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
      id: fixture.itemId,
      orderId: fixture.orderId,
      productId: fixture.productId,
      offerId: fixture.offerId,
      productNameSnapshot: `P11 buyer access ${fixture.productId}`,
      unitPriceMinor: 2990,
      quantity: 1,
      totalMinor: 2990,
      currency: "BRL",
    },
  });

  await db.entitlement.create({
    data: {
      id: fixture.entitlementId,
      orderItemId: fixture.itemId,
      status: "ACTIVE",
      activatedAt: new Date("2026-09-13T10:00:01.000Z"),
    },
  });

  await db.digitalResource.create({
    data: {
      id: fixture.resourceId,
      logicalKey: `p11-buyer-${fixture.resourceId}`,
      storageKey: `p11-buyer/${fixture.resourceId}`,
      filename: `${fixture.resourceId}.pdf`,
      mediaType: "application/pdf",
      status: "ACTIVE",
    },
  });

  await db.entitlementDigitalResource.create({
    data: {
      entitlementId: fixture.entitlementId,
      resourceId: fixture.resourceId,
    },
  });
}

async function cleanupFixture(): Promise<void> {
  if (!fixture) return;

  await db.digitalDeliveryEvent.deleteMany({
    where: {
      buyerAccessCredential: {
        orderId: fixture.orderId,
      },
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

  await db.entitlement.deleteMany({
    where: {
      id: fixture.entitlementId,
    },
  });

  await db.digitalResource.deleteMany({
    where: {
      id: fixture.resourceId,
    },
  });

  await db.orderItem.deleteMany({
    where: {
      id: fixture.itemId,
    },
  });

  await db.order.deleteMany({
    where: {
      id: fixture.orderId,
    },
  });

  await db.customer.deleteMany({
    where: {
      id: fixture.customerId,
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
}

describe("P11 buyer access credential issuance on isolated MySQL", () => {
  beforeAll(async () => {
    db = createDatabaseClient(guardedTestUrl());
    await db.$connect();

    repository = new PrismaBuyerAccessCredentialRepository(db);

    const secretService = new OpaqueBuyerAccessCredentialService();

    useCase = new IssueBuyerAccessCredential(repository, secretService);

    revokeUseCase = new RevokeBuyerAccessCredential(repository);

    reissueUseCase = new ReissueBuyerAccessCredential(repository, secretService);
  });

  beforeEach(createFixture);
  afterEach(cleanupFixture);

  afterAll(async () => {
    await db?.$disconnect();
  });

  it("issues one ACTIVE credential for an eligible paid order", async () => {
    const issued = await useCase.execute(fixture.orderId);

    expect(issued.orderId).toBe(fixture.orderId);
    expect(issued.rawCredential).toMatch(/^lba_[A-Za-z0-9_-]{43}$/u);

    const persisted = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(persisted).toMatchObject({
      orderId: fixture.orderId,
      status: "ACTIVE",
      activeOrderKey: fixture.orderId,
      lastUsedAt: null,
      revokedAt: null,
    });
  });

  it("persists only the SHA-256 hash and never the raw credential", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const persisted = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    const hashed = new OpaqueBuyerAccessCredentialService().hash(issued.rawCredential);

    expect(hashed.ok).toBe(true);

    if (!hashed.ok) {
      throw new Error("issued credential unexpectedly became malformed");
    }

    expect(persisted.secretHash).toBe(hashed.secretHash);
    expect(persisted.secretHash).not.toBe(issued.rawCredential);

    expect(JSON.stringify(persisted)).not.toContain(issued.rawCredential);
  });

  it("rejects repeated issuance instead of returning or replacing the existing secret", async () => {
    const first = await useCase.execute(fixture.orderId);

    await expect(useCase.execute(fixture.orderId)).rejects.toThrow(
      "ACTIVE_CREDENTIAL_ALREADY_EXISTS",
    );

    const credentials = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
      },
    });

    expect(credentials).toHaveLength(1);
    expect(credentials[0]?.id).toBe(first.credentialId);
  });

  it("rejects a paid order whose entitlement is not ACTIVE", async () => {
    await db.entitlement.update({
      where: {
        id: fixture.entitlementId,
      },
      data: {
        status: "PENDING",
        activatedAt: null,
      },
    });

    await expect(useCase.execute(fixture.orderId)).rejects.toThrow(
      "BUYER_ACCESS_ENTITLEMENT_NOT_READY",
    );

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(0);
  });

  it("rejects an ACTIVE entitlement with no persisted resource grant", async () => {
    await db.entitlementDigitalResource.deleteMany({
      where: {
        entitlementId: fixture.entitlementId,
      },
    });

    await expect(useCase.execute(fixture.orderId)).rejects.toThrow(
      "BUYER_ACCESS_ENTITLEMENT_NOT_READY",
    );

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(0);
  });

  it("rejects an order that is no longer PAID", async () => {
    await db.order.update({
      where: {
        id: fixture.orderId,
      },
      data: {
        status: "REFUNDED",
      },
    });

    await expect(useCase.execute(fixture.orderId)).rejects.toThrow(
      "BUYER_ACCESS_ORDER_NOT_ELIGIBLE",
    );

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(0);
  });

  it("serializes concurrent issuance so at most one ACTIVE credential exists", async () => {
    const results = await Promise.allSettled([
      useCase.execute(fixture.orderId),
      useCase.execute(fixture.orderId),
      useCase.execute(fixture.orderId),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);

    for (const result of rejected) {
      if (result.status !== "rejected") continue;

      expect(String(result.reason)).toContain("ACTIVE_CREDENTIAL_ALREADY_EXISTS");
    }

    const active = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
        status: "ACTIVE",
      },
    });

    expect(active).toHaveLength(1);
    expect(active[0]?.activeOrderKey).toBe(fixture.orderId);
  });

  it("rejects an invalid order identifier before touching persistence", async () => {
    await expect(useCase.execute("not-a-uuid")).rejects.toThrow("INVALID_BUYER_ACCESS_ORDER_ID");

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(0);
  });

  it("revokes the expected ACTIVE credential while preserving its history", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const before = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(await revokeUseCase.execute(fixture.orderId, issued.credentialId)).toBe("REVOKED");

    const after = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(after.id).toBe(before.id);
    expect(after.secretHash).toBe(before.secretHash);
    expect(after.status).toBe("REVOKED");
    expect(after.activeOrderKey).toBeNull();
    expect(after.revokedAt).toBeInstanceOf(Date);
  });

  it("treats repeated revocation of the same credential as an idempotent NOOP", async () => {
    const issued = await useCase.execute(fixture.orderId);

    expect(await revokeUseCase.execute(fixture.orderId, issued.credentialId)).toBe("REVOKED");

    expect(await revokeUseCase.execute(fixture.orderId, issued.credentialId)).toBe("NOOP");

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(1);

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
          status: "ACTIVE",
        },
      }),
    ).toBe(0);
  });

  it("reissues by revoking the expected credential and returning one new raw secret", async () => {
    const original = await useCase.execute(fixture.orderId);

    const reissued = await reissueUseCase.execute(fixture.orderId, original.credentialId);

    expect(reissued.credentialId).not.toBe(original.credentialId);

    expect(reissued.rawCredential).not.toBe(original.rawCredential);

    const rows = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
      },
    });

    expect(rows).toHaveLength(2);

    const oldRow = rows.find((row) => row.id === original.credentialId);

    const newRow = rows.find((row) => row.id === reissued.credentialId);

    expect(oldRow?.status).toBe("REVOKED");
    expect(oldRow?.activeOrderKey).toBeNull();
    expect(oldRow?.revokedAt).toBeInstanceOf(Date);

    expect(newRow?.status).toBe("ACTIVE");
    expect(newRow?.activeOrderKey).toBe(fixture.orderId);
    expect(newRow?.revokedAt).toBeNull();

    const hashed = new OpaqueBuyerAccessCredentialService().hash(reissued.rawCredential);

    expect(hashed.ok).toBe(true);

    if (!hashed.ok) {
      throw new Error("reissued credential unexpectedly malformed");
    }

    expect(newRow?.secretHash).toBe(hashed.secretHash);

    expect(JSON.stringify(rows)).not.toContain(reissued.rawCredential);
  });

  it("rejects a stale reissue after the expected credential has already rotated", async () => {
    const original = await useCase.execute(fixture.orderId);

    const firstRotation = await reissueUseCase.execute(fixture.orderId, original.credentialId);

    await expect(reissueUseCase.execute(fixture.orderId, original.credentialId)).rejects.toThrow(
      "BUYER_ACCESS_CREDENTIAL_ROTATED",
    );

    const active = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
        status: "ACTIVE",
      },
    });

    expect(active).toHaveLength(1);

    expect(active[0]?.id).toBe(firstRotation.credentialId);

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(2);
  });

  it("serializes concurrent reissue so only one returned credential becomes ACTIVE", async () => {
    const original = await useCase.execute(fixture.orderId);

    const results = await Promise.allSettled([
      reissueUseCase.execute(fixture.orderId, original.credentialId),
      reissueUseCase.execute(fixture.orderId, original.credentialId),
      reissueUseCase.execute(fixture.orderId, original.credentialId),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");

    const rejected = results.filter((result) => result.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(2);

    for (const result of rejected) {
      if (result.status !== "rejected") {
        continue;
      }

      expect(String(result.reason)).toContain("BUYER_ACCESS_CREDENTIAL_ROTATED");
    }

    const active = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
        status: "ACTIVE",
      },
    });

    expect(active).toHaveLength(1);

    const winner = fulfilled[0];

    if (!winner || winner.status !== "fulfilled") {
      throw new Error("concurrent reissue winner missing");
    }

    expect(active[0]?.id).toBe(winner.value.credentialId);

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(2);
  });

  it("does not revoke the current credential when reissue eligibility fails", async () => {
    const original = await useCase.execute(fixture.orderId);

    await db.order.update({
      where: {
        id: fixture.orderId,
      },
      data: {
        status: "REFUNDED",
      },
    });

    await expect(reissueUseCase.execute(fixture.orderId, original.credentialId)).rejects.toThrow(
      "BUYER_ACCESS_ORDER_NOT_ELIGIBLE",
    );

    const current = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: original.credentialId,
      },
    });

    expect(current.status).toBe("ACTIVE");
    expect(current.activeOrderKey).toBe(fixture.orderId);
    expect(current.revokedAt).toBeNull();

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(1);
  });

  it("exchanges a valid opaque credential for a buyer session and records last use", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    const result = await exchange.execute(issued.rawCredential);

    expect(result.sessionToken.startsWith("v1.")).toBe(true);

    const verified = new HmacBuyerSession(EXCHANGE_SESSION_SECRET).verify(result.sessionToken);

    expect(verified).not.toBeNull();

    expect(verified).toMatchObject({
      customerId: fixture.customerId,
      orderId: fixture.orderId,
      credentialId: issued.credentialId,
      purpose: "BUYER_SESSION",
      version: 1,
    });

    const persisted = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(persisted.lastUsedAt).toBeInstanceOf(Date);
  });

  it("rejects a malformed raw credential with only ACCESS_INVALID", async () => {
    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    await expect(exchange.execute("not-a-credential")).rejects.toThrow("ACCESS_INVALID");

    expect(
      await db.buyerAccessCredential.count({
        where: {
          orderId: fixture.orderId,
        },
      }),
    ).toBe(0);
  });

  it("rejects an unknown well-formed credential with only ACCESS_INVALID", async () => {
    const unknown = new OpaqueBuyerAccessCredentialService().issue();

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    await expect(exchange.execute(unknown.rawCredential)).rejects.toThrow("ACCESS_INVALID");
  });

  it("rejects a revoked credential and does not update lastUsedAt", async () => {
    const issued = await useCase.execute(fixture.orderId);

    expect(await revokeUseCase.execute(fixture.orderId, issued.credentialId)).toBe("REVOKED");

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    await expect(exchange.execute(issued.rawCredential)).rejects.toThrow("ACCESS_INVALID");

    const persisted = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(persisted.lastUsedAt).toBeNull();
  });

  it("rejects exchange after the Order is refunded", async () => {
    const issued = await useCase.execute(fixture.orderId);

    await db.order.update({
      where: {
        id: fixture.orderId,
      },
      data: {
        status: "REFUNDED",
      },
    });

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    await expect(exchange.execute(issued.rawCredential)).rejects.toThrow("ACCESS_INVALID");

    const persisted = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(persisted.lastUsedAt).toBeNull();
  });

  it("rejects exchange when the Entitlement is no longer ACTIVE", async () => {
    const issued = await useCase.execute(fixture.orderId);

    await db.entitlement.update({
      where: {
        id: fixture.entitlementId,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date("2026-09-13T11:00:00.000Z"),
      },
    });

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    await expect(exchange.execute(issued.rawCredential)).rejects.toThrow("ACCESS_INVALID");

    const persisted = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(persisted.lastUsedAt).toBeNull();
  });

  it("invalidates the old raw credential after reissue while the new raw credential exchanges successfully", async () => {
    const original = await useCase.execute(fixture.orderId);

    const replacement = await reissueUseCase.execute(fixture.orderId, original.credentialId);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      new HmacBuyerSession(EXCHANGE_SESSION_SECRET),
    );

    await expect(exchange.execute(original.rawCredential)).rejects.toThrow("ACCESS_INVALID");

    const result = await exchange.execute(replacement.rawCredential);

    const verified = new HmacBuyerSession(EXCHANGE_SESSION_SECRET).verify(result.sessionToken);

    expect(verified).toMatchObject({
      customerId: fixture.customerId,
      orderId: fixture.orderId,
      credentialId: replacement.credentialId,
    });

    const oldCredential = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: original.credentialId,
      },
    });

    const newCredential = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: replacement.credentialId,
      },
    });

    expect(oldCredential.lastUsedAt).toBeNull();

    expect(newCredential.lastUsedAt).toBeInstanceOf(Date);
  });

  it("validates an exchanged buyer session against current persisted access state", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      sessionService,
    );

    const exchanged = await exchange.execute(issued.rawCredential);

    const before = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(exchanged.sessionToken)).resolves.toEqual({
      customerId: fixture.customerId,
      orderId: fixture.orderId,
      credentialId: issued.credentialId,
    });

    const after = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(after.lastUsedAt).toEqual(before.lastUsedAt);
  });

  it("rejects a revoked credential even when its HMAC session is still cryptographically valid", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      sessionService,
    );

    const exchanged = await exchange.execute(issued.rawCredential);

    expect(sessionService.verify(exchanged.sessionToken)).not.toBeNull();

    expect(await revokeUseCase.execute(fixture.orderId, issued.credentialId)).toBe("REVOKED");

    expect(sessionService.verify(exchanged.sessionToken)).not.toBeNull();

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(exchanged.sessionToken)).rejects.toThrow("SESSION_INVALID");
  });

  it("invalidates the old session after reissue while a session from the replacement credential is valid", async () => {
    const original = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      sessionService,
    );

    const oldSession = await exchange.execute(original.rawCredential);

    const replacement = await reissueUseCase.execute(fixture.orderId, original.credentialId);

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(oldSession.sessionToken)).rejects.toThrow("SESSION_INVALID");

    const newSession = await exchange.execute(replacement.rawCredential);

    await expect(validator.execute(newSession.sessionToken)).resolves.toEqual({
      customerId: fixture.customerId,
      orderId: fixture.orderId,
      credentialId: replacement.credentialId,
    });
  });

  it("rejects an otherwise valid session after the Order is refunded", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      sessionService,
    );

    const exchanged = await exchange.execute(issued.rawCredential);

    await db.order.update({
      where: {
        id: fixture.orderId,
      },
      data: {
        status: "REFUNDED",
      },
    });

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(exchanged.sessionToken)).rejects.toThrow("SESSION_INVALID");
  });

  it("rejects an otherwise valid session after its Entitlement is revoked", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      sessionService,
    );

    const exchanged = await exchange.execute(issued.rawCredential);

    await db.entitlement.update({
      where: {
        id: fixture.entitlementId,
      },
      data: {
        status: "REVOKED",
        revokedAt: new Date("2026-09-13T11:30:00.000Z"),
      },
    });

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(exchanged.sessionToken)).rejects.toThrow("SESSION_INVALID");
  });

  it("rejects a correctly signed session whose customer does not own the Order", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const wrongCustomerSession = sessionService.issue({
      customerId: randomUUID(),
      orderId: fixture.orderId,
      credentialId: issued.credentialId,
    });

    expect(sessionService.verify(wrongCustomerSession)).not.toBeNull();

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(wrongCustomerSession)).rejects.toThrow("SESSION_INVALID");
  });

  it("rejects a tampered session before database authorization can succeed", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const sessionService = new HmacBuyerSession(EXCHANGE_SESSION_SECRET);

    const exchange = new ExchangeBuyerAccessCredential(
      repository,
      new OpaqueBuyerAccessCredentialService(),
      sessionService,
    );

    const exchanged = await exchange.execute(issued.rawCredential);

    const segments = exchanged.sessionToken.split(".");

    const signature = segments[2];

    if (segments.length !== 3 || !signature) {
      throw new Error("buyer session fixture malformed");
    }

    const replacement = signature.startsWith("A") ? "B" : "A";

    const tampered = [segments[0], segments[1], `${replacement}${signature.slice(1)}`].join(".");

    const validator = new ValidateBuyerSession(repository, sessionService);

    await expect(validator.execute(tampered)).rejects.toThrow("SESSION_INVALID");
  });

  // P11 C6.2 recovery commercial-right isolation

  async function snapshotRecoveryCommercialRight() {
    const order = await db.order.findUniqueOrThrow({
      where: {
        id: fixture.orderId,
      },
      select: {
        id: true,
        status: true,
        paidAt: true,
      },
    });

    const items = await db.orderItem.findMany({
      where: {
        orderId: fixture.orderId,
      },
      select: {
        id: true,
      },
      orderBy: {
        id: "asc",
      },
    });

    const entitlements = await db.entitlement.findMany({
      where: {
        orderItemId: {
          in: items.map((item) => item.id),
        },
      },
      include: {
        resources: {
          orderBy: {
            resourceId: "asc",
          },
        },
      },
      orderBy: {
        id: "asc",
      },
    });

    return {
      order: {
        id: order.id,
        status: order.status,
        paidAt: order.paidAt?.toISOString() ?? null,
      },

      entitlements: entitlements.map((entitlement) => ({
        id: entitlement.id,
        orderItemId: entitlement.orderItemId,
        sourceOutboxEventId: entitlement.sourceOutboxEventId,
        status: entitlement.status,
        activatedAt: entitlement.activatedAt?.toISOString() ?? null,
        revokedAt: entitlement.revokedAt?.toISOString() ?? null,
        resources: entitlement.resources.map((resource) => resource.resourceId),
      })),
    };
  }

  it("revoking a Buyer Access credential does not mutate Order, Entitlement, or historical grants", async () => {
    const issued = await useCase.execute(fixture.orderId);

    const before = await snapshotRecoveryCommercialRight();

    expect(await revokeUseCase.execute(fixture.orderId, issued.credentialId)).toBe("REVOKED");

    const after = await snapshotRecoveryCommercialRight();

    expect(after).toEqual(before);

    const credential = await db.buyerAccessCredential.findUniqueOrThrow({
      where: {
        id: issued.credentialId,
      },
    });

    expect(credential.status).toBe("REVOKED");

    expect(credential.activeOrderKey).toBeNull();

    expect(credential.revokedAt).toBeInstanceOf(Date);
  });

  it("reissuing a Buyer Access credential rotates only access material and preserves the commercial right", async () => {
    const original = await useCase.execute(fixture.orderId);

    const before = await snapshotRecoveryCommercialRight();

    const replacement = await reissueUseCase.execute(fixture.orderId, original.credentialId);

    const after = await snapshotRecoveryCommercialRight();

    expect(after).toEqual(before);

    const credentials = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    expect(credentials).toHaveLength(2);

    const oldCredential = credentials.find((entry) => entry.id === original.credentialId);

    const newCredential = credentials.find((entry) => entry.id === replacement.credentialId);

    expect(oldCredential).toMatchObject({
      status: "REVOKED",
      activeOrderKey: null,
    });

    expect(oldCredential?.revokedAt).toBeInstanceOf(Date);

    expect(newCredential).toMatchObject({
      status: "ACTIVE",
      activeOrderKey: fixture.orderId,
    });

    expect(newCredential?.revokedAt).toBeNull();

    expect(JSON.stringify(credentials)).not.toContain(replacement.rawCredential);
  });

  it("a failed stale recovery attempt preserves both the replacement credential and the commercial right", async () => {
    const original = await useCase.execute(fixture.orderId);

    const replacement = await reissueUseCase.execute(fixture.orderId, original.credentialId);

    const before = await snapshotRecoveryCommercialRight();

    await expect(reissueUseCase.execute(fixture.orderId, original.credentialId)).rejects.toThrow(
      "BUYER_ACCESS_CREDENTIAL_ROTATED",
    );

    const after = await snapshotRecoveryCommercialRight();

    expect(after).toEqual(before);

    const active = await db.buyerAccessCredential.findMany({
      where: {
        orderId: fixture.orderId,
        status: "ACTIVE",
      },
    });

    expect(active).toHaveLength(1);

    expect(active[0]?.id).toBe(replacement.credentialId);
  });
});
