import { hasAdminPermission } from "@/modules/administration/application/admin-permissions";
import type { AdminSessionState } from "@/modules/administration/infrastructure/admin-subject";

export function adminPageDecision(state: AdminSessionState | null, permission?: string) {
  if (!state) return "LOGIN" as const;
  if (!state.mfaComplete) return "ENROLL" as const;
  if (permission && !hasAdminPermission(state.role, permission)) return "FORBIDDEN" as const;
  return "ALLOWED" as const;
}
