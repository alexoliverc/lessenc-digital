import { requireAdminPage } from "../../admin-access";
import { listPayments, parseAdminListQuery } from "../../admin-query";
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
export default async function Payments({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("payment.read", true);
  const query = parseAdminListQuery(await searchParams);
  const rows = await listPayments(database, query);
  return (
    <>
      <PageHeader
        eyebrow="Somente leitura"
        title="Pagamentos"
        description="Observações sanitizadas do provedor; o estado permanece sob autoridade P10."
      />
      <SearchForm value={query.search} placeholder="ID interno, pedido ou referência" />
      {rows.length === 0 ? (
        <Empty>Nenhum pagamento corresponde à busca.</Empty>
      ) : (
        <Table
          headers={[
            "Pagamento",
            "Pedido",
            "Estado",
            "Provedor",
            "Referência",
            "Valor",
            "Revisão",
            "Criado",
          ]}
        >
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <DetailLink href={`/admin/payments/${row.id}`}>{row.id}</DetailLink>
              </td>
              <td>{row.orderId}</td>
              <td>
                <Status>{row.status}</Status>
              </td>
              <td>{row.provider ?? "—"}</td>
              <td>{row.providerPaymentId ?? row.providerOrderId ?? "—"}</td>
              <td>{money(row.amountMinor, row.currency)}</td>
              <td>{row.requiresReview ? (row.reviewReason ?? "Requer revisão") : "—"}</td>
              <td>{date(row.createdAt)}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
