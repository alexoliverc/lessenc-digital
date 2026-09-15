import { randomUUID } from "node:crypto";

import type { AdminRole, Prisma, PrismaClient } from "@/generated/prisma/client";
import { AdminAccessDenied, requireAdminPermission, type AdminSubject } from "./admin-subject";

type AuditMetadata = Readonly<{
  reasonCode?: string;
  previousRole?: AdminRole;
  newRole?: AdminRole;
}>;

const METADATA_KEYS = new Set(["reasonCode", "previousRole", "newRole"]);

export function sanitizeAdminAuditMetadata(input: Record<string, unknown>): AuditMetadata {
  for (const key of Object.keys(input)) {
    if (!METADATA_KEYS.has(key)) throw new Error("Unsupported administrative audit metadata");
  }
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || value.length > 64 || !/^[A-Za-z0-9_-]+$/u.test(value)) {
      throw new Error("Invalid administrative audit metadata");
    }
    if (
      (key === "previousRole" || key === "newRole") &&
      !["OWNER", "ADMIN", "SUPPORT"].includes(value)
    ) {
      throw new Error("Invalid administrative audit role");
    }
    if (key === "reasonCode" && value !== "ACCESS_DENIED") {
      throw new Error("Invalid administrative audit reason");
    }
    output[key] = value;
  }
  return Object.freeze(output);
}

export async function recordAdminDenial(input: {
  database: PrismaClient;
  subject: AdminSubject;
  action: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  reasonCode: string;
}): Promise<void> {
  const session = await input.database.adminSession.findUnique({
    where: { id: input.subject.adminSessionId },
    select: { userId: true },
  });
  const actor =
    session?.userId === input.subject.adminUserId
      ? await input.database.adminUser.findUnique({
          where: { id: session.userId },
          select: { id: true, role: true },
        })
      : null;
  await input.database.adminAuditEvent.create({
    data: {
      actorAdminUserId: actor?.id ?? null,
      actorRole: actor?.role ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      outcome: "DENIED",
      correlationId: input.correlationId ?? randomUUID(),
      metadata: sanitizeAdminAuditMetadata({ reasonCode: input.reasonCode }),
    },
  });
}

export async function runCriticalAdminMutation<T>(input: {
  database: PrismaClient;
  subject: AdminSubject;
  permission: string;
  fresh?: boolean;
  action: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  mutate: (transaction: Prisma.TransactionClient) => Promise<T>;
}): Promise<T> {
  requireAdminPermission(input.subject, input.permission, { fresh: input.fresh ?? false });
  const metadata = sanitizeAdminAuditMetadata(input.metadata ?? {});
  const correlationId = input.correlationId ?? randomUUID();
  return input.database.$transaction(async (transaction) => {
    // Lock the authoritative identity, session and factor before validating the mutation.
    await transaction.$queryRaw`SELECT id FROM admin_users WHERE id = ${input.subject.adminUserId} FOR UPDATE`;
    await transaction.$queryRaw`SELECT id FROM admin_sessions WHERE id = ${input.subject.adminSessionId} FOR UPDATE`;
    await transaction.$queryRaw`SELECT id FROM admin_two_factors WHERE user_id = ${input.subject.adminUserId} FOR UPDATE`;
    const now = new Date();
    const [actor, session, factor] = await Promise.all([
      transaction.adminUser.findUnique({ where: { id: input.subject.adminUserId } }),
      transaction.adminSession.findUnique({ where: { id: input.subject.adminSessionId } }),
      transaction.adminTwoFactor.findFirst({
        where: { userId: input.subject.adminUserId, verified: true },
        select: { id: true },
      }),
    ]);
    if (
      !actor ||
      actor.role !== input.subject.role ||
      actor.twoFactorEnabled !== true ||
      !actor.emailVerified ||
      !factor ||
      !session ||
      session.userId !== actor.id ||
      session.expiresAt <= now ||
      session.createdAt.getTime() + 8 * 60 * 60 * 1000 <= now.getTime() ||
      session.lastActivityAt.getTime() + 30 * 60 * 1000 <= now.getTime() ||
      (input.fresh && session.createdAt.getTime() + 5 * 60 * 1000 <= now.getTime())
    )
      throw new AdminAccessDenied(403);

    const result = await input.mutate(transaction);
    await transaction.adminAuditEvent.create({
      data: {
        actorAdminUserId: actor.id,
        actorRole: actor.role,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        outcome: "SUCCEEDED",
        correlationId,
        metadata,
      },
    });
    return result;
  });
}
