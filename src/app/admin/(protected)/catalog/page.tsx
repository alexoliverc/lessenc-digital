import { hasAdminPermission } from "@/modules/administration/application/admin-permissions";
import { requireAdminPage } from "../../admin-access";
import { listCatalog, parseAdminListQuery, allowedProductStatuses } from "../../admin-query";
import { date, Empty, money, PageHeader, SearchForm, Status, Table } from "../../admin-ui";
import { updateProductStatus } from "./actions";
export const dynamic = "force-dynamic";
export default async function Catalog({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database, subject } = await requireAdminPage("catalog.read");
  const query = parseAdminListQuery(await searchParams);
  const rows = await listCatalog(database, query);
  const canWrite = hasAdminPermission(subject.role, "catalog.write");
  return (
    <>
      <PageHeader
        eyebrow="Operação comercial"
        title="Catálogo"
        description="Produtos e ofertas existentes. Alterações não modificam pedidos históricos."
      />
      <SearchForm value={query.search} placeholder="Nome do produto" />
      {rows.length === 0 ? (
        <Empty>Ajuste a busca ou aguarde novos produtos.</Empty>
      ) : (
        <Table headers={["Produto", "Status", "Oferta atual", "Atualizado", "Ação"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                <br />
                <small>{row.description ?? "Sem descrição"}</small>
              </td>
              <td>
                <Status>{row.status}</Status>
              </td>
              <td>
                {row.offers[0]
                  ? `${money(row.offers[0].priceMinor, row.offers[0].currency)} · ${row.offers[0].isActive ? "ativa" : "inativa"}`
                  : "—"}
              </td>
              <td>{date(row.updatedAt)}</td>
              <td>
                {canWrite ? (
                  <form action={updateProductStatus}>
                    <input type="hidden" name="id" value={row.id} />
                    <label>
                      <span className="admin-kicker">Novo status</span>
                      <select className="admin-select" name="status" defaultValue={row.status}>
                        {allowedProductStatuses.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </select>
                    </label>
                    <button className="admin-primary">Salvar</button>
                  </form>
                ) : (
                  "Somente leitura"
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
