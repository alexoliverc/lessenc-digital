import { requireAdminPage } from "../../admin-access";
import { listEntitlements, parseAdminListQuery } from "../../admin-query";
import { date, DetailLink, Empty, PageHeader, SearchForm, Status, Table } from "../../admin-ui";
export const dynamic = "force-dynamic";
export default async function Entitlements({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("entitlement.read", true);
  const query = parseAdminListQuery(await searchParams);
  const rows = await listEntitlements(database, query);
  return (
    <>
      <PageHeader
        eyebrow="Verdade P11"
        title="Entitlements"
        description="Direitos e proveniência imutável, sem controles de ativação manual."
      />
      <SearchForm value={query.search} placeholder="ID ou e-mail" />
      {rows.length === 0 ? (
        <Empty>Nenhum entitlement corresponde à busca.</Empty>
      ) : (
        <Table
          headers={["Entitlement", "Pedido", "Cliente", "Produto", "Estado", "Recursos", "Criado"]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <DetailLink href={`/admin/entitlements/${row.id}`}>{row.id}</DetailLink>
              </td>
              <td>{row.orderItem.orderId}</td>
              <td>{row.orderItem.order.customer.email}</td>
              <td>{row.orderItem.productNameSnapshot}</td>
              <td>
                <Status>{row.status}</Status>
              </td>
              <td>{row._count.resources}</td>
              <td>{date(row.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
