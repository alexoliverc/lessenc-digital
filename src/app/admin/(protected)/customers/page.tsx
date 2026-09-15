import { requireAdminPage } from "../../admin-access";
import { listCustomers, parseAdminListQuery } from "../../admin-query";
import { date, DetailLink, Empty, PageHeader, SearchForm, Table } from "../../admin-ui";
export const dynamic = "force-dynamic";
export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("customer.read", true);
  const query = parseAdminListQuery(await searchParams);
  const rows = await listCustomers(database, query);
  return (
    <>
      <PageHeader
        eyebrow="Suporte"
        title="Clientes"
        description="Exibição mínima de dados pessoais para atendimento."
      />
      <SearchForm value={query.search} placeholder="E-mail" />
      {rows.length === 0 ? (
        <Empty>Nenhum cliente corresponde à busca.</Empty>
      ) : (
        <Table headers={["Cliente", "E-mail", "Pedidos", "Criado"]}>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <DetailLink href={`/admin/customers/${row.id}`}>{row.id}</DetailLink>
              </td>
              <td>{row.email}</td>
              <td>{row._count.orders}</td>
              <td>{date(row.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
