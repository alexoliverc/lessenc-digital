import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getAdminAuth } from "@/infrastructure/auth/admin-auth";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { resolveAdminSession } from "@/modules/administration/infrastructure/admin-subject";
import { adminPageDecision } from "./admin-page-decision";

export async function requireAdminPage(permission?: string, hideUnauthorized = false) {
  const database = getDatabaseClient();
  const adminAuth = getAdminAuth();
  const state = await resolveAdminSession({ auth: adminAuth, database, headers: await headers() });
  const decision = adminPageDecision(state, permission);
  if (decision === "LOGIN") redirect("/admin/login");
  if (decision === "ENROLL") redirect("/admin/mfa/enroll");
  if (decision === "FORBIDDEN") {
    if (hideUnauthorized) notFound();
    redirect("/admin/forbidden");
  }
  if (!state) redirect("/admin/login");
  const user = await database.adminUser.findUnique({
    where: { id: state.adminUserId },
    select: { name: true, email: true, twoFactorEnabled: true },
  });
  if (!user) redirect("/admin/login");
  return { database, subject: state, user };
}
