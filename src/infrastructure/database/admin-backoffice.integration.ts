import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listCatalog, listOrders, parseAdminListQuery } from "@/app/admin/admin-query";
import { changeProductStatus } from "@/modules/administration/infrastructure/change-product-status";
import type { AdminSubject } from "@/modules/administration/infrastructure/admin-subject";
import { createDatabaseClient } from "./client";

function guardedTestUrl() {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw) throw new Error("P12 backoffice requires test DB");
  const url = new URL(raw);
  if (url.hostname !== "127.0.0.1" || url.port !== "3307" || url.pathname !== "/lessenc_test")
    throw new Error("P12 backoffice refused non-isolated database");
  return raw;
}

const db = createDatabaseClient(guardedTestUrl());
const ownerId = randomUUID(),
  supportId = randomUUID(),
  ownerSessionId = randomUUID(),
  supportSessionId = randomUUID(),
  productId = randomUUID();
function subject(id: string, session: string, role: "OWNER" | "SUPPORT"): AdminSubject {
  return { adminUserId: id, adminSessionId: session, role, fresh: true };
}

describe("P12 operational backoffice", () => {
  beforeAll(async () => {
    for (const [id, role, sessionId] of [
      [ownerId, "OWNER", ownerSessionId],
      [supportId, "SUPPORT", supportSessionId],
    ] as const) {
      await db.adminUser.create({
        data: {
          id,
          name: "P12 F/G synthetic",
          email: `${id}@example.invalid`,
          role,
          emailVerified: true,
          twoFactorEnabled: true,
        },
      });
      await db.adminTwoFactor.create({
        data: {
          id: randomUUID(),
          userId: id,
          secret: "fixture",
          backupCodes: "fixture",
          verified: true,
        },
      });
      await db.adminSession.create({
        data: {
          id: sessionId,
          userId: id,
          token: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }
    await db.product.create({
      data: { id: productId, name: "P12 F/G synthetic product", status: "DRAFT" },
    });
  });

  afterAll(async () => {
    await db.adminAuditEvent.deleteMany({
      where: { actorAdminUserId: { in: [ownerId, supportId] } },
    });
    await db.adminSession.deleteMany({ where: { userId: { in: [ownerId, supportId] } } });
    await db.adminTwoFactor.deleteMany({ where: { userId: { in: [ownerId, supportId] } } });
    await db.adminUser.deleteMany({ where: { id: { in: [ownerId, supportId] } } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.$disconnect();
  });

  it("uses bounded catalog and order read models", async () => {
    const query = parseAdminListQuery({ q: "P12 F/G synthetic", limit: "500" });
    const catalog = await listCatalog(db, query);
    expect(query.limit).toBe(50);
    expect(catalog).toHaveLength(1);
    expect((await listOrders(db, parseAdminListQuery({ limit: "1" }))).length).toBeLessThanOrEqual(
      1,
    );
  });

  it("allows catalog.write and writes the mandatory admin audit", async () => {
    await changeProductStatus({
      database: db,
      subject: subject(ownerId, ownerSessionId, "OWNER"),
      productId,
      status: "ACTIVE",
    });
    expect(await db.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({
      status: "ACTIVE",
    });
    expect(
      await db.adminAuditEvent.count({
        where: {
          actorAdminUserId: ownerId,
          action: "PRODUCT_STATUS_CHANGED",
          outcome: "SUCCEEDED",
        },
      }),
    ).toBe(1);
  });

  it("denies SUPPORT catalog mutation and audits the denial", async () => {
    await expect(
      changeProductStatus({
        database: db,
        subject: subject(supportId, supportSessionId, "SUPPORT"),
        productId,
        status: "ARCHIVED",
      }),
    ).rejects.toThrow();
    expect(await db.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({
      status: "ACTIVE",
    });
    expect(
      await db.adminAuditEvent.count({
        where: {
          actorAdminUserId: supportId,
          action: "PRODUCT_STATUS_CHANGE_DENIED",
          outcome: "DENIED",
        },
      }),
    ).toBe(1);
  });
});
