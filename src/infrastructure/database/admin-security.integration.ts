import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { changeAdminRole } from "@/modules/administration/infrastructure/change-admin-role";
import { resetAdminMfa } from "@/modules/administration/infrastructure/reset-admin-mfa";
import { runCriticalAdminMutation } from "@/modules/administration/infrastructure/admin-audit";
import { normalizeCorrelationId } from "@/lib/observability/correlation";
import {
  resolveAdminSubject,
  type AdminSubject,
} from "@/modules/administration/infrastructure/admin-subject";
import { createDatabaseClient } from "./client";

function guardedTestUrl(): string {
  const raw = process.env.TEST_DATABASE_URL;
  if (process.env.APP_ENV !== "test" || !raw)
    throw new Error("P12 security requires a test database");
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.port !== "3307" ||
    url.pathname !== "/lessenc_test" ||
    !url.username ||
    !url.password
  )
    throw new Error("P12 security refused a non-isolated P06 test database");
  return raw;
}

const db = createDatabaseClient(guardedTestUrl());
const ownerId = randomUUID();
const adminId = randomUUID();
const supportId = randomUUID();
const ownerSessionId = randomUUID();
const adminSessionId = randomUUID();
const supportSessionId = randomUUID();
const ownedIds = [ownerId, adminId, supportId];
const now = new Date();

function auth(userId: string, sessionId: string) {
  return {
    api: {
      getSession: async () => ({ user: { id: userId }, session: { id: sessionId, userId } }),
    },
  };
}

function subject(
  userId: string,
  sessionId: string,
  role: AdminSubject["role"],
  fresh = true,
): AdminSubject {
  return { adminUserId: userId, adminSessionId: sessionId, role, fresh };
}

describe("P12 authoritative admin session and audit", () => {
  beforeAll(async () => {
    for (const [id, role] of [
      [ownerId, "OWNER"],
      [adminId, "ADMIN"],
      [supportId, "SUPPORT"],
    ] as const) {
      await db.adminUser.create({
        data: {
          id,
          name: "P12 synthetic fixture",
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
          secret: "fixture-only",
          backupCodes: "fixture-only",
          verified: true,
        },
      });
    }
    for (const [id, userId] of [
      [ownerSessionId, ownerId],
      [adminSessionId, adminId],
      [supportSessionId, supportId],
    ] as const) {
      await db.adminSession.create({
        data: {
          id,
          userId,
          token: randomUUID(),
          expiresAt: new Date(now.getTime() + 8 * 60 * 60_000),
        },
      });
    }
  });

  afterAll(async () => {
    await db.adminAuditEvent.deleteMany({ where: { actorAdminUserId: { in: ownedIds } } });
    await db.adminSession.deleteMany({ where: { userId: { in: ownedIds } } });
    await db.adminTwoFactor.deleteMany({ where: { userId: { in: ownedIds } } });
    await db.adminUser.deleteMany({ where: { id: { in: ownedIds } } });
    await db.$disconnect();
  });

  it("resolves a valid session from authoritative admin rows and updates activity", async () => {
    const before = await db.adminSession.update({
      where: { id: ownerSessionId },
      data: { lastActivityAt: new Date(Date.now() - 10_000) },
    });
    const resolved = await resolveAdminSubject({
      auth: auth(ownerId, ownerSessionId),
      database: db,
      headers: new Headers(),
    });
    expect(resolved).toMatchObject({ adminUserId: ownerId, role: "OWNER", fresh: true });
    const after = await db.adminSession.findUniqueOrThrow({ where: { id: ownerSessionId } });
    expect(after.lastActivityAt.getTime()).toBeGreaterThan(before.lastActivityAt.getTime());
  });

  it("rejects another user's session and a primary-only identity", async () => {
    expect(
      await resolveAdminSubject({
        auth: auth(supportId, ownerSessionId),
        database: db,
        headers: new Headers(),
      }),
    ).toBeNull();
    await db.adminUser.update({ where: { id: supportId }, data: { twoFactorEnabled: false } });
    expect(
      await resolveAdminSubject({
        auth: auth(supportId, supportSessionId),
        database: db,
        headers: new Headers(),
      }),
    ).toBeNull();
    await db.adminUser.update({ where: { id: supportId }, data: { twoFactorEnabled: true } });
  });

  it("revokes an idle-expired session and rejects absolute expiry", async () => {
    const idleId = randomUUID();
    const absoluteId = randomUUID();
    await db.adminSession.createMany({
      data: [
        {
          id: idleId,
          userId: supportId,
          token: randomUUID(),
          expiresAt: new Date(now.getTime() + 60_000),
          lastActivityAt: new Date(now.getTime() - 31 * 60_000),
        },
        {
          id: absoluteId,
          userId: supportId,
          token: randomUUID(),
          createdAt: new Date(now.getTime() - 9 * 60 * 60_000),
          expiresAt: new Date(now.getTime() + 60_000),
        },
      ],
    });
    expect(
      await resolveAdminSubject({
        auth: auth(supportId, idleId),
        database: db,
        headers: new Headers(),
      }),
    ).toBeNull();
    expect(await db.adminSession.findUnique({ where: { id: idleId } })).toBeNull();
    expect(
      await resolveAdminSubject({
        auth: auth(supportId, absoluteId),
        database: db,
        headers: new Headers(),
      }),
    ).toBeNull();
  });

  it("denies a revoked session immediately", async () => {
    const id = randomUUID();
    await db.adminSession.create({
      data: {
        id,
        userId: supportId,
        token: randomUUID(),
        expiresAt: new Date(now.getTime() + 60_000),
      },
    });
    await db.adminSession.delete({ where: { id } });
    expect(
      await resolveAdminSubject({
        auth: auth(supportId, id),
        database: db,
        headers: new Headers(),
      }),
    ).toBeNull();
  });

  it("denies SUPPORT role management and records denial", async () => {
    await expect(
      changeAdminRole({
        database: db,
        subject: subject(supportId, supportSessionId, "SUPPORT"),
        targetAdminUserId: ownerId,
        newRole: "ADMIN",
      }),
    ).rejects.toThrow();
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: ownerId } })).toMatchObject({
      role: "OWNER",
    });
    expect(
      await db.adminAuditEvent.count({ where: { actorAdminUserId: supportId, outcome: "DENIED" } }),
    ).toBeGreaterThan(0);
  });

  it("denies ADMIN self-escalation and a substituted actor session", async () => {
    await expect(
      changeAdminRole({
        database: db,
        subject: subject(adminId, adminSessionId, "ADMIN"),
        targetAdminUserId: adminId,
        newRole: "OWNER",
      }),
    ).rejects.toThrow();
    await expect(
      changeAdminRole({
        database: db,
        subject: subject(ownerId, supportSessionId, "OWNER"),
        targetAdminUserId: adminId,
        newRole: "OWNER",
      }),
    ).rejects.toThrow();
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({
      role: "ADMIN",
    });
  });

  it("rechecks the database fresh window even if the caller marks a stale subject fresh", async () => {
    const staleId = randomUUID();
    const staleAt = new Date(Date.now() - 6 * 60_000);
    await db.adminSession.create({
      data: {
        id: staleId,
        userId: ownerId,
        token: randomUUID(),
        createdAt: staleAt,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(
      await resolveAdminSubject({
        auth: auth(ownerId, staleId),
        database: db,
        headers: new Headers(),
      }),
    ).toMatchObject({ fresh: false });
    await expect(
      changeAdminRole({
        database: db,
        subject: subject(ownerId, staleId, "OWNER", true),
        targetAdminUserId: adminId,
        newRole: "SUPPORT",
      }),
    ).rejects.toThrow();
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({
      role: "ADMIN",
    });
  });

  it("requires fresh OWNER session and protects the final OWNER", async () => {
    await expect(
      changeAdminRole({
        database: db,
        subject: subject(ownerId, ownerSessionId, "OWNER", false),
        targetAdminUserId: adminId,
        newRole: "SUPPORT",
      }),
    ).rejects.toThrow();
    await expect(
      changeAdminRole({
        database: db,
        subject: subject(ownerId, ownerSessionId, "OWNER"),
        targetAdminUserId: ownerId,
        newRole: "ADMIN",
      }),
    ).rejects.toThrow();
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: ownerId } })).toMatchObject({
      role: "OWNER",
    });
  });

  it("allows an OWNER role change and writes a success audit", async () => {
    const changed = await changeAdminRole({
      database: db,
      subject: subject(ownerId, ownerSessionId, "OWNER"),
      targetAdminUserId: adminId,
      newRole: "SUPPORT",
    });
    expect(changed.role).toBe("SUPPORT");
    expect(
      await db.adminAuditEvent.count({
        where: { actorAdminUserId: ownerId, action: "ADMIN_ROLE_CHANGED", outcome: "SUCCEEDED" },
      }),
    ).toBe(1);
    const roleAudit = await db.adminAuditEvent.findFirstOrThrow({
      where: { actorAdminUserId: ownerId, action: "ADMIN_ROLE_CHANGED", outcome: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
    });
    expect(normalizeCorrelationId(roleAudit.correlationId)).toBe(roleAudit.correlationId);
  });

  it("rolls a critical mutation back when mandatory audit persistence fails", async () => {
    await expect(
      runCriticalAdminMutation({
        database: db,
        subject: subject(ownerId, ownerSessionId, "OWNER"),
        permission: "admin.role.manage",
        action: "X".repeat(200),
        mutate: async (transaction) =>
          transaction.adminUser.update({
            where: { id: adminId },
            data: { role: "ADMIN" },
            select: { id: true },
          }),
      }),
    ).rejects.toThrow();
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({
      role: "SUPPORT",
    });
  });

  it("allows only a fresh OWNER to reset another synthetic admin MFA and revokes target sessions", async () => {
    await expect(
      resetAdminMfa({
        database: db,
        subject: subject(supportId, supportSessionId, "SUPPORT"),
        targetAdminUserId: adminId,
      }),
    ).rejects.toThrow();
    await expect(
      resetAdminMfa({
        database: db,
        subject: subject(ownerId, ownerSessionId, "OWNER", false),
        targetAdminUserId: adminId,
      }),
    ).rejects.toThrow();
    await expect(
      resetAdminMfa({
        database: db,
        subject: subject(ownerId, ownerSessionId, "OWNER"),
        targetAdminUserId: ownerId,
      }),
    ).rejects.toThrow();
    await resetAdminMfa({
      database: db,
      subject: subject(ownerId, ownerSessionId, "OWNER"),
      targetAdminUserId: adminId,
    });
    expect(await db.adminTwoFactor.count({ where: { userId: adminId } })).toBe(0);
    expect(await db.adminUser.findUniqueOrThrow({ where: { id: adminId } })).toMatchObject({
      twoFactorEnabled: false,
    });
    expect(await db.adminSession.count({ where: { userId: adminId } })).toBe(0);
    expect(
      await resolveAdminSubject({
        auth: auth(adminId, adminSessionId),
        database: db,
        headers: new Headers(),
      }),
    ).toBeNull();
    expect(
      await db.adminAuditEvent.count({
        where: { actorAdminUserId: ownerId, action: "ADMIN_MFA_RESET", outcome: "SUCCEEDED" },
      }),
    ).toBe(1);
    const mfaAudit = await db.adminAuditEvent.findFirstOrThrow({
      where: { actorAdminUserId: ownerId, action: "ADMIN_MFA_RESET", outcome: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
    });
    expect(normalizeCorrelationId(mfaAudit.correlationId)).toBe(mfaAudit.correlationId);
  });
});
