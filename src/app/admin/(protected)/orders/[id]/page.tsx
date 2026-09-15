import { notFound } from "next/navigation";
import { requireAdminPage } from "../../../admin-access";
import { isAdminResourceId } from "../../../admin-query";
import { date, money, PageHeader, Status } from "../../../admin-ui";
export const dynamic = "force-dynamic";
export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { database } = await requireAdminPage("order.read", true);
  const { id } = await params;
  if (!isAdminResourceId(id)) notFound();
  const row = await database.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      totalMinor: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      paidAt: true,
      customer: { select: { email: true } },
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          quantity: true,
          totalMinor: true,
          currency: true,
          entitlement: { select: { id: true, status: true } },
        },
      },
      payments: {
        select: { id: true, status: true, provider: true, amountMinor: true, currency: true },
      },
    },
  });
  if (!row) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Pedido"
        title={row.id}
        description="Registro canônico de pedido, sem ações financeiras manuais."
      />
      <section className="admin-card">
        <dl className="admin-field-list">
          <dt>Status</dt>
          <dd>
            <Status>{row.status}</Status>
          </dd>
          <dt>Cliente</dt>
          <dd>{row.customer.email}</dd>
          <dt>Total</dt>
          <dd>{money(row.totalMinor, row.currency)}</dd>
          <dt>Criado</dt>
          <dd>{date(row.createdAt)}</dd>
          <dt>Pago em</dt>
          <dd>{date(row.paidAt)}</dd>
        </dl>
      </section>
      <section className="admin-section admin-card">
        <h2>Itens e entitlement</h2>
        {row.items.map((item) => (
          <p key={item.id}>
            {item.productNameSnapshot} · {item.quantity} × {money(item.totalMinor, item.currency)} ·{" "}
            {item.entitlement?.status ?? "sem entitlement"}
          </p>
        ))}
      </section>
      <section className="admin-section admin-card">
        <h2>Pagamentos vinculados</h2>
        {row.payments.map((item) => (
          <p key={item.id}>
            {item.provider ?? "provedor pendente"} · {item.status} ·{" "}
            {money(item.amountMinor, item.currency)}
          </p>
        ))}
      </section>
    </>
  );
}
