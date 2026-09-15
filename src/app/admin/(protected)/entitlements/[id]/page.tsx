import { notFound } from "next/navigation";
import { requireAdminPage } from "../../../admin-access";
import { isAdminResourceId } from "../../../admin-query";
import { date, PageHeader, Status, Table } from "../../../admin-ui";
export const dynamic = "force-dynamic";
export default async function EntitlementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { database } = await requireAdminPage("entitlement.read", true);
  const { id } = await params;
  if (!isAdminResourceId(id)) notFound();
  const row = await database.entitlement.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      sourceOutboxEventId: true,
      createdAt: true,
      activatedAt: true,
      revokedAt: true,
      orderItem: {
        select: {
          orderId: true,
          productNameSnapshot: true,
          order: { select: { customer: { select: { email: true } } } },
        },
      },
      resources: {
        select: {
          grantedAt: true,
          resource: { select: { id: true, filename: true, version: true, status: true } },
        },
      },
    },
  });
  if (!row) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Entitlement"
        title={row.id}
        description="Registro autoritativo P11 e snapshot de recursos concedidos."
      />
      <section className="admin-card">
        <dl className="admin-field-list">
          <dt>Estado</dt>
          <dd>
            <Status>{row.status}</Status>
          </dd>
          <dt>Pedido</dt>
          <dd>{row.orderItem.orderId}</dd>
          <dt>Cliente</dt>
          <dd>{row.orderItem.order.customer.email}</dd>
          <dt>Produto</dt>
          <dd>{row.orderItem.productNameSnapshot}</dd>
          <dt>Proveniência</dt>
          <dd>{row.sourceOutboxEventId ?? "—"}</dd>
          <dt>Ativado</dt>
          <dd>{date(row.activatedAt)}</dd>
          <dt>Revogado</dt>
          <dd>{date(row.revokedAt)}</dd>
        </dl>
      </section>
      <section className="admin-section">
        <h2>Recursos concedidos</h2>
        <Table headers={["Recurso", "Arquivo", "Versão", "Estado", "Concedido"]}>
          {row.resources.map((item) => (
            <tr key={item.resource.id}>
              <td>{item.resource.id}</td>
              <td>{item.resource.filename}</td>
              <td>{item.resource.version}</td>
              <td>{item.resource.status}</td>
              <td>{date(item.grantedAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
    </>
  );
}
