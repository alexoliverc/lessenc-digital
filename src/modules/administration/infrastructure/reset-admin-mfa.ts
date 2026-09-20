import type { PrismaClient } from "@/generated/prisma/client";
import { createCorrelationId } from "@/lib/observability/correlation";
import { recordAdminDenial, runCriticalAdminMutation } from "./admin-audit";
import { AdminAccessDenied, type AdminSubject } from "./admin-subject";

// Server-only recovery command for a future OWNER workflow. No HTTP route is exposed in P12-D.
export async function resetAdminMfa(input: {
  database: PrismaClient;
  subject: AdminSubject;
  targetAdminUserId: string;
  correlationId?: string;
}): Promise<void> {
  const correlationId = input.correlationId ?? createCorrelationId();
  try {
    await runCriticalAdminMutation({
      database: input.database,
      subject: input.subject,
      permission: "admin.identity.manage",
      fresh: true,
      action: "ADMIN_MFA_RESET",
      targetType: "AdminUser",
      targetId: input.targetAdminUserId,
      correlationId,
      mutate: async (transaction) => {
        if (input.targetAdminUserId === input.subject.adminUserId) throw new AdminAccessDenied(403);
        const target = await transaction.adminUser.findUnique({
          where: { id: input.targetAdminUserId },
          select: { id: true, twoFactorEnabled: true },
        });
        if (!target?.twoFactorEnabled) throw new AdminAccessDenied(403);
        await transaction.adminTwoFactor.deleteMany({ where: { userId: target.id } });
        await transaction.adminUser.update({
          where: { id: target.id },
          data: { twoFactorEnabled: false },
        });
        await transaction.adminSession.deleteMany({ where: { userId: target.id } });
      },
    });
  } catch (error) {
    if (error instanceof AdminAccessDenied) {
      try {
        await recordAdminDenial({
          database: input.database,
          subject: input.subject,
          action: "ADMIN_MFA_RESET_DENIED",
          targetType: "AdminUser",
          targetId: input.targetAdminUserId,
          correlationId,
          reasonCode: "ACCESS_DENIED",
        });
      } catch {
        // The denied operation remains closed if its best-effort denial audit fails.
      }
    }
    throw error;
  }
}
