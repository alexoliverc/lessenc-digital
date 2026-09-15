import { MfaForm } from "../../admin-auth-client";
export default function MfaPage() {
  return (
    <section className="admin-auth-card">
      <p className="admin-kicker">Verificação em duas etapas</p>
      <h1>Confirme sua identidade</h1>
      <p>Use o código do aplicativo autenticador ou um código de recuperação.</p>
      <MfaForm />
    </section>
  );
}
