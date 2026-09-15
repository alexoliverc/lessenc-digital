import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/infrastructure/auth/admin-auth";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { resolveAdminSession } from "@/modules/administration/infrastructure/admin-subject";
import { EnrollmentForm } from "../../../admin-auth-client";
export const dynamic = "force-dynamic";
export default async function EnrollPage() {
  const state = await resolveAdminSession({
    auth: adminAuth,
    database: getDatabaseClient(),
    headers: await headers(),
  });
  if (!state) redirect("/admin/login");
  if (state.mfaComplete) redirect("/admin");
  return (
    <section className="admin-auth-card">
      <p className="admin-kicker">MFA obrigatório</p>
      <h1>Configure seu autenticador</h1>
      <p>Conclua a inscrição antes de acessar qualquer operação.</p>
      <EnrollmentForm />
    </section>
  );
}
