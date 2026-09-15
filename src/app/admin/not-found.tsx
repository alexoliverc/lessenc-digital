import Link from "next/link";
export default function NotFound() {
  return (
    <main className="admin-public">
      <section className="admin-auth-card">
        <p className="admin-kicker">Não encontrado</p>
        <h1>Registro indisponível</h1>
        <p>O item não existe ou você não possui permissão para visualizá-lo.</p>
        <Link href="/admin">Voltar ao painel</Link>
      </section>
    </main>
  );
}
