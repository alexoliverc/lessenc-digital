import { notFound } from "next/navigation";
import { requireAdminPage } from "../../../admin-access";
import { isAdminResourceId } from "../../../admin-query";
import { date, money, PageHeader, Status, Table } from "../../../admin-ui";
export const dynamic = "force-dynamic";
export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { database } = await requireAdminPage("customer.read", true);
  const { id } = await params;
  if (!isAdminResourceId(id)) notFound();
  const row = await database.customer.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          totalMinor: true,
          currency: true,
          createdAt: true,
          items: { select: { entitlement: { select: { id: true, status: true } } } },
        },
      },
    },
  });
  if (!row) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Cliente"
        title={row.email}
        description="Histórico de suporte limitado aos pedidos e entitlements vinculados."
      />
      <section className="admin-card">
        <dl className="admin-field-list">
          <dt>ID</dt>
          <dd>{row.id}</dd>
          <dt>Criado</dt>
          <dd>{date(row.createdAt)}</dd>
        </dl>
      </section>
      <section className="admin-section">
        <h2>Pedidos recentes</h2>
        <Table headers={["Pedido", "Estado", "Total", "Entitlement", "Criado"]}>
          {row.orders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>
                <Status>{order.status}</Status>
              </td>
              <td>{money(order.totalMinor, order.currency)}</td>
              <td>
                {order.items
                  .map((item) => item.entitlement?.status)
                  .filter(Boolean)
                  .join(", ") || "—"}
              </td>
              <td>{date(order.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
