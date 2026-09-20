import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAdminAuth } from "@/infrastructure/auth/admin-auth";
import { getDatabaseClient } from "@/infrastructure/database/client";
import { resolveAdminSession } from "@/modules/administration/infrastructure/admin-subject";
import { LoginForm } from "../../admin-auth-client";
export const dynamic = "force-dynamic";
export default async function LoginPage() {
  const state = await resolveAdminSession({
    auth: getAdminAuth(),
    database: getDatabaseClient(),
    headers: await headers(),
  });
  if (state) redirect(state.mfaComplete ? "/admin" : "/admin/mfa/enroll");
  return (
    <section className="admin-auth-card">
      <p className="admin-kicker">L&apos;Essenc Operações</p>
      <h1>Acesso administrativo</h1>
      <p>Entre com sua identidade individual. O segundo fator é obrigatório.</p>
      <LoginForm />
    </section>
  );
}
