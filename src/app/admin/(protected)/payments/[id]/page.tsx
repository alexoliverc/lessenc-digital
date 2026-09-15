import { notFound } from "next/navigation";
import { requireAdminPage } from "../../../admin-access";
import { isAdminResourceId } from "../../../admin-query";
import { date, money, PageHeader, Status, Table } from "../../../admin-ui";
export const dynamic = "force-dynamic";
export default async function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { database } = await requireAdminPage("payment.read", true);
  const { id } = await params;
  if (!isAdminResourceId(id)) notFound();
  const row = await database.payment.findUnique({
    where: { id },
    select: {
      id: true,
      orderId: true,
      status: true,
      amountMinor: true,
      currency: true,
      provider: true,
      providerOrderId: true,
      providerPaymentId: true,
      providerStatus: true,
      providerStatusDetail: true,
      attemptNumber: true,
      requiresReview: true,
      reviewReason: true,
      createdAt: true,
      updatedAt: true,
      events: {
        orderBy: { observedAt: "desc" },
        take: 20,
        select: {
          id: true,
          source: true,
          providerStatus: true,
          providerStatusDetail: true,
          applicationResult: true,
          observedAt: true,
        },
      },
    },
  });
  if (!row) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Pagamento"
        title={row.id}
        description="Detalhes operacionais sanitizados e exclusivamente de leitura."
      />
      <section className="admin-card">
        <dl className="admin-field-list">
          <dt>Pedido</dt>
          <dd>{row.orderId}</dd>
          <dt>Estado</dt>
          <dd>
            <Status>{row.status}</Status>
          </dd>
          <dt>Valor</dt>
          <dd>{money(row.amountMinor, row.currency)}</dd>
          <dt>Provedor</dt>
          <dd>{row.provider ?? "—"}</dd>
          <dt>Referência</dt>
          <dd>{row.providerPaymentId ?? row.providerOrderId ?? "—"}</dd>
          <dt>Estado no provedor</dt>
          <dd>
            {row.providerStatus ?? "—"} {row.providerStatusDetail ?? ""}
          </dd>
          <dt>Revisão</dt>
          <dd>{row.requiresReview ? (row.reviewReason ?? "Sim") : "Não"}</dd>
        </dl>
      </section>
      <section className="admin-section">
        <h2>Eventos recentes</h2>
        <Table headers={["Origem", "Estado", "Resultado", "Observado"]}>
          {row.events.map((event) => (
            <tr key={event.id}>
              <td>{event.source}</td>
              <td>
                {event.providerStatus} {event.providerStatusDetail ?? ""}
              </td>
              <td>{event.applicationResult}</td>
              <td>{date(event.observedAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
