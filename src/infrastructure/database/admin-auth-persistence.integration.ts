import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDatabaseClient } from "./client";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw) throw new Error("P12-B requires a test database");
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    !["/lessenc_test", "/lessenc_test_rebuild"].includes(url.pathname) ||
    !url.username ||
    !url.password
  ) {
    throw new Error("P12-B refused a non-isolated P06 test database");
  }
  return raw;
}

const db = createDatabaseClient(guardedTestUrl());
const adminId = randomUUID();
const customerId = randomUUID();
const sessionId = randomUUID();
const accountId = randomUUID();
const twoFactorId = randomUUID();
const verificationId = randomUUID();
const bucketId = randomUUID();
const email = `p12-${adminId}@example.invalid`;

describe("P12-B isolated administrative persistence", () => {
  beforeAll(async () => {
    await db.customer.create({ data: { id: customerId, email } });
    await db.adminUser.create({
      data: { id: adminId, name: "P12 fixture", email, emailVerified: true },
    });
  });

  afterAll(async () => {
    await db.adminSession.deleteMany({ where: { id: sessionId } });
    await db.adminAccount.deleteMany({ where: { id: accountId } });
    await db.adminTwoFactor.deleteMany({ where: { id: twoFactorId } });
    await db.adminVerification.deleteMany({ where: { id: verificationId } });
    await db.adminAuthRateLimitBucket.deleteMany({ where: { id: bucketId } });
    await db.adminUser.deleteMany({ where: { id: adminId } });
    await db.customer.deleteMany({ where: { id: customerId } });
    await db.$disconnect();
  });

  it("stores Customer and AdminUser independently even with the same email", async () => {
    expect(await db.customer.findUnique({ where: { id: customerId } })).not.toBeNull();
    expect(await db.adminUser.findUnique({ where: { id: adminId } })).not.toBeNull();
    await expect(
      db.adminUser.create({ data: { id: randomUUID(), name: "duplicate", email } }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("lets the Better Auth Prisma adapter read an AdminUser through its isolated client", async () => {
    const oldRuntimeUrl = process.env.DB_RUNTIME_URL;
    const oldSecret = process.env.P12_ADMIN_AUTH_SECRET;
    process.env.DB_RUNTIME_URL = guardedTestUrl();
    process.env.P12_ADMIN_AUTH_SECRET = "p12-integration-fixture-secret-over-32-characters";
    try {
      const { createAdminAuth } = await import("@/infrastructure/auth/admin-auth");
      const adminAuth = createAdminAuth(db);
      const context = await adminAuth.$context;
      const user = await context.adapter.findOne({
        model: "user",
        where: [{ field: "id", value: adminId }],
      });
      expect(user).toMatchObject({ id: adminId, email });
    } finally {
      if (oldRuntimeUrl === undefined) delete process.env.DB_RUNTIME_URL;
      else process.env.DB_RUNTIME_URL = oldRuntimeUrl;
      if (oldSecret === undefined) delete process.env.P12_ADMIN_AUTH_SECRET;
      else process.env.P12_ADMIN_AUTH_SECRET = oldSecret;
    }
  });

  it("binds admin sessions and accounts only to AdminUser and enforces unique tokens", async () => {
    await expect(
      db.adminSession.create({
        data: { id: randomUUID(), userId: customerId, token: randomUUID(), expiresAt: new Date() },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
    await expect(
      db.adminAccount.create({
        data: {
          id: randomUUID(),
          userId: customerId,
          accountId: customerId,
          providerId: "credential",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });

    const token = randomUUID();
    await db.adminSession.create({
      data: { id: sessionId, userId: adminId, token, expiresAt: new Date(Date.now() + 60_000) },
    });
    await db.adminAccount.create({
      data: { id: accountId, userId: adminId, accountId: adminId, providerId: "credential" },
    });
    await expect(
      db.adminSession.create({
        data: {
          id: randomUUID(),
          userId: adminId,
          token,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("persists verification, two-factor state, and database rate-limit buckets", async () => {
    await db.adminVerification.create({
      data: { id: verificationId, identifier: email, value: "fixture-only", expiresAt: new Date() },
    });
    await db.adminTwoFactor.create({
      data: {
        id: twoFactorId,
        userId: adminId,
        secret: "fixture-only",
        backupCodes: "fixture-only",
      },
    });
    await db.adminAuthRateLimitBucket.create({
      data: { id: bucketId, key: `fixture-${bucketId}`, count: 1, lastRequest: BigInt(1) },
    });
    expect(await db.adminVerification.count({ where: { id: verificationId } })).toBe(1);
    expect(await db.adminTwoFactor.count({ where: { userId: adminId } })).toBe(1);
    expect(await db.adminAuthRateLimitBucket.count({ where: { id: bucketId } })).toBe(1);
  });

  it("retains the independent commerce delegates and no entitlement on AdminUser", async () => {
    expect(db.order).toBeDefined();
    expect(db.buyerAccessCredential).toBeDefined();
    expect(db.entitlement).toBeDefined();
    expect(await db.customer.count({ where: { id: customerId } })).toBe(1);
    expect(
      await db.adminUser.findUnique({ where: { id: adminId }, include: { sessions: true } }),
    ).toMatchObject({ id: adminId });
    await expect(
      db.order.create({
        data: {
          id: randomUUID(),
          customerId: adminId,
          totalMinor: 2990,
          currency: "BRL",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
});
