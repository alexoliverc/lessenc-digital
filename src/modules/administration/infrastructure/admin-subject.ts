import type { AdminRole, PrismaClient } from "@/generated/prisma/client";
import { hasAdminPermission } from "../application/admin-permissions";

const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;
const FRESH_MS = 5 * 60 * 1000;

export class AdminAccessDenied extends Error {
  constructor(readonly status: 401 | 403 = 401) {
    super("Administrative access denied");
  }
}

export type AdminSubject = Readonly<{
  adminUserId: string;
  adminSessionId: string;
  role: AdminRole;
  fresh: boolean;
}>;

export type AdminSessionState = AdminSubject & Readonly<{ mfaComplete: boolean }>;

type AuthSessionReader = {
  api: {
    getSession: (input: { headers: Headers }) => Promise<{
      user: { id: string };
      session: { id: string; userId: string };
    } | null>;
  };
};

export async function resolveAdminSession(input: {
  auth: AuthSessionReader;
  database: PrismaClient;
  headers: Headers;
}): Promise<AdminSessionState | null> {
  const { auth, database, headers } = input;
  const now = new Date();
  const authenticated = await auth.api.getSession({ headers });
  if (!authenticated?.session || !authenticated.user) return null;

  const session = await database.adminSession.findUnique({
    where: { id: authenticated.session.id },
  });
  if (
    !session ||
    session.userId !== authenticated.user.id ||
    session.userId !== authenticated.session.userId
  )
    return null;

  const absoluteDeadline = session.createdAt.getTime() + ABSOLUTE_MS;
  const idleCutoff = new Date(now.getTime() - IDLE_MS);
  if (
    session.expiresAt <= now ||
    absoluteDeadline <= now.getTime() ||
    session.lastActivityAt <= idleCutoff
  ) {
    await database.adminSession.deleteMany({ where: { id: session.id, userId: session.userId } });
    return null;
  }

  const user = await database.adminUser.findUnique({ where: { id: session.userId } });
  if (!user || !user.emailVerified) return null;
  const factor = user.twoFactorEnabled
    ? await database.adminTwoFactor.findFirst({
        where: { userId: user.id, verified: true },
        select: { id: true },
      })
    : null;

  // An atomic compare-and-update prevents a concurrent revocation or idle expiry from racing in.
  const updated = await database.adminSession.updateMany({
    where: {
      id: session.id,
      userId: user.id,
      expiresAt: { gt: now },
      lastActivityAt: { gt: idleCutoff },
    },
    data: { lastActivityAt: now },
  });
  if (updated.count !== 1) return null;

  return Object.freeze({
    adminUserId: user.id,
    adminSessionId: session.id,
    role: user.role,
    fresh: now.getTime() - session.createdAt.getTime() < FRESH_MS,
    mfaComplete: user.twoFactorEnabled === true && factor !== null,
  });
}

export async function resolveAdminSubject(input: Parameters<typeof resolveAdminSession>[0]) {
  const state = await resolveAdminSession(input);
  if (!state?.mfaComplete) return null;
  const { adminUserId, adminSessionId, role, fresh } = state;
  return Object.freeze({ adminUserId, adminSessionId, role, fresh });
}

export async function requireAdminSubject(input: Parameters<typeof resolveAdminSession>[0]) {
  const subject = await resolveAdminSubject(input);
  if (!subject) throw new AdminAccessDenied();
  return subject;
}

export function requireAdminPermission(
  subject: AdminSubject,
  permission: string,
  options: { fresh?: boolean } = {},
): void {
  if (!hasAdminPermission(subject.role, permission)) throw new AdminAccessDenied(403);
  if (options.fresh && !subject.fresh) throw new AdminAccessDenied(403);
}
