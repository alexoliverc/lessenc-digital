import { requireAdminPage } from "../../admin-access";
import { listDeliveries, parseAdminListQuery } from "../../admin-query";
import { date, Empty, PageHeader, SearchForm, Status, Table } from "../../admin-ui";
export const dynamic = "force-dynamic";
export default async function Deliveries({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("delivery.read", true);
  const query = parseAdminListQuery(await searchParams);
  const rows = await listDeliveries(database, query);
  return (
    <>
      <PageHeader
        eyebrow="Entrega protegida"
        title="Entregas"
        description="Histórico append-only e estado sanitizado de credenciais."
      />
      <p className="admin-note">
        A recuperação não é exposta aqui: a operação canônica P11 ainda não participa da mesma
        transação da auditoria administrativa obrigatória.
      </p>
      <SearchForm value={query.search} placeholder="Entitlement ou credencial" />
      {rows.length === 0 ? (
        <Empty>Nenhum evento de entrega corresponde à busca.</Empty>
      ) : (
        <Table
          headers={[
            "Evento",
            "Entitlement",
            "Recurso",
            "Credencial",
            "Estado da credencial",
            "Resultado",
            "Falha",
            "Criado",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.id}</td>
              <td>{row.entitlementId}</td>
              <td>{row.resourceId}</td>
              <td>{row.buyerAccessCredentialId}</td>
              <td>{row.buyerAccessCredential.status}</td>
              <td>
                <Status>{row.outcome}</Status>
              </td>
              <td>{row.failureCode ?? "—"}</td>
              <td>{date(row.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
