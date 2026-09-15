import { requireAdminPage } from "../../admin-access";
import { listOrders, parseAdminListQuery } from "../../admin-query";
import {
  date,
  DetailLink,
  Empty,
  money,
  PageHeader,
  SearchForm,
  Status,
  Table,
} from "../../admin-ui";
export const dynamic = "force-dynamic";
export default async function Orders({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("order.read", true);
  const query = parseAdminListQuery(await searchParams);
  const rows = await listOrders(database, query);
  return (
    <>
      <PageHeader
        eyebrow="Somente leitura"
        title="Pedidos"
        description="Estado financeiro canônico produzido pelo fluxo P10."
      />
      <SearchForm value={query.search} placeholder="ID ou e-mail" />
      {rows.length === 0 ? (
        <Empty>Nenhum pedido corresponde à busca.</Empty>
      ) : (
        <Table headers={["Pedido", "Cliente", "Status", "Pagamento", "Total", "Criado"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <DetailLink href={`/admin/orders/${row.id}`}>{row.id}</DetailLink>
              </td>
              <td>{row.customer.email}</td>
              <td>
                <Status>{row.status}</Status>
              </td>
              <td>{row.payments[0]?.status ?? "—"}</td>
              <td>{money(row.totalMinor, row.currency)}</td>
              <td>{date(row.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
