import { date, PageHeader, Status } from "../../admin-ui";
import { requireAdminPage } from "../../admin-access";
import { RegenerateBackupCodes } from "../../admin-auth-client";
export const dynamic = "force-dynamic";
export default async function Account() {
  const { database, subject, user } = await requireAdminPage("security.self");
  const session = await database.adminSession.findUnique({
    where: { id: subject.adminSessionId },
    select: { createdAt: true, expiresAt: true, lastActivityAt: true },
  });
  return (
    <>
      <PageHeader
        eyebrow="Minha conta"
        title="Conta e segurança"
        description="Dados autoritativos da identidade administrativa atual."
      />
      <div className="admin-two-column">
        <section className="admin-card">
          <h2>Perfil</h2>
          <dl className="admin-field-list">
            <dt>Nome</dt>
            <dd>{user.name}</dd>
            <dt>E-mail</dt>
            <dd>{user.email}</dd>
            <dt>Papel</dt>
            <dd>
              <Status>{subject.role}</Status>
            </dd>
            <dt>MFA</dt>
            <dd>{user.twoFactorEnabled ? "Ativo" : "Pendente"}</dd>
          </dl>
        </section>
        <section className="admin-card">
          <h2>Sessão atual</h2>
          <dl className="admin-field-list">
            <dt>Início</dt>
            <dd>{date(session?.createdAt)}</dd>
            <dt>Última atividade</dt>
            <dd>{date(session?.lastActivityAt)}</dd>
            <dt>Expiração</dt>
            <dd>{date(session?.expiresAt)}</dd>
            <dt>Autenticação fresca</dt>
            <dd>{subject.fresh ? "Sim" : "Não"}</dd>
          </dl>
        </section>
      </div>
      <RegenerateBackupCodes />
    </>
  );
}
