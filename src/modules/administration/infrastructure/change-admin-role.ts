import type { AdminRole, PrismaClient } from "@/generated/prisma/client";
import { createCorrelationId } from "@/lib/observability/correlation";
import { recordAdminDenial, runCriticalAdminMutation } from "./admin-audit";
import { AdminAccessDenied, type AdminSubject } from "./admin-subject";

export async function changeAdminRole(input: {
  database: PrismaClient;
  subject: AdminSubject;
  targetAdminUserId: string;
  newRole: AdminRole;
  correlationId?: string;
}): Promise<{ id: string; role: AdminRole }> {
  const correlationId = input.correlationId ?? createCorrelationId();
  try {
    return await runCriticalAdminMutation({
      database: input.database,
      subject: input.subject,
      permission: "admin.role.manage",
      fresh: true,
      action: "ADMIN_ROLE_CHANGED",
      targetType: "AdminUser",
      targetId: input.targetAdminUserId,
      correlationId,
      mutate: async (transaction) => {
        // Lock OWNER rows before checking whether this would remove the final OWNER.
        const owners = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM admin_users WHERE role = 'OWNER' FOR UPDATE
        `;
        const target = await transaction.adminUser.findUnique({
          where: { id: input.targetAdminUserId },
        });
        if (!target) throw new AdminAccessDenied(403);
        if (target.role === "OWNER" && input.newRole !== "OWNER" && owners.length <= 1) {
          throw new AdminAccessDenied(403);
        }
        return transaction.adminUser.update({
          where: { id: target.id },
          data: { role: input.newRole },
          select: { id: true, role: true },
        });
      },
    });
  } catch (error) {
    if (error instanceof AdminAccessDenied) {
      try {
        await recordAdminDenial({
          database: input.database,
          subject: input.subject,
          action: "ADMIN_ROLE_CHANGE_DENIED",
          targetType: "AdminUser",
          targetId: input.targetAdminUserId,
          correlationId,
          reasonCode: "ACCESS_DENIED",
        });
      } catch {
        // Denial still fails closed if its audit cannot be persisted.
      }
    }
    throw error;
  }
}
