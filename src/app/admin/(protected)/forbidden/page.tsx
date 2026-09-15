import Link from "next/link";
import { PageHeader } from "../../admin-ui";
export default function Forbidden() {
  return (
    <>
      <PageHeader
        eyebrow="Acesso negado"
        title="Permissão insuficiente"
        description="Sua conta não possui acesso a esta área."
      />
      <Link href="/admin">Voltar ao dashboard</Link>
    </>
  );
}
