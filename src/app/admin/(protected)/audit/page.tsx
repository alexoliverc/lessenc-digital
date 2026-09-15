import { requireAdminPage } from "../../admin-access";
import { listAudit, parseAdminListQuery } from "../../admin-query";
import { date, Empty, PageHeader, SearchForm, Status, Table } from "../../admin-ui";
export const dynamic = "force-dynamic";
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("audit.read", true);
  const query = parseAdminListQuery(await searchParams);
  const rows = await listAudit(database, query);
  return (
    <>
      <PageHeader
        eyebrow="Registro append-only"
        title="Auditoria administrativa"
        description="Pesquisa limitada por ação, correlação ou ator. Não há edição ou exclusão."
      />
      <SearchForm value={query.search} placeholder="Ação, correlação ou ator" />
      {rows.length === 0 ? (
        <Empty>Nenhum evento corresponde à busca.</Empty>
      ) : (
        <Table
          headers={[
            "Data",
            "Ator",
            "Papel",
            "Ação",
            "Alvo",
            "Resultado",
            "Correlação",
            "Metadados",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{date(row.createdAt)}</td>
              <td>{row.actor?.name ?? row.actor?.email ?? "Sistema"}</td>
              <td>{row.actorRole ?? "—"}</td>
              <td>{row.action}</td>
              <td>
                {row.targetType ?? "—"} {row.targetId ?? ""}
              </td>
              <td>
                <Status>{row.outcome}</Status>
              </td>
              <td>{row.correlationId}</td>
              <td>{row.metadata ? JSON.stringify(row.metadata) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
