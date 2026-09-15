import { hasAdminPermission } from "@/modules/administration/application/admin-permissions";
import { requireAdminPage } from "../admin-access";
import { date, money, PageHeader, Status, Table } from "../admin-ui";
import { readDashboard } from "../admin-query";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  const { database, subject } = await requireAdminPage();
  const data = await readDashboard(database, {
    catalog: hasAdminPermission(subject.role, "catalog.read"),
    audit: hasAdminPermission(subject.role, "audit.read"),
  });
  return (
    <>
      <PageHeader
        eyebrow="Visão operacional"
        title="Dashboard"
        description="Indicadores atuais calculados a partir dos registros canônicos."
      />
      <div className="admin-grid">
        {[
          ["Produtos", data.products],
          ["Pedidos", data.orders],
          ["Clientes", data.customers],
          ["Entitlements ativos", data.activeEntitlements],
          ["Entitlements revogados", data.revokedEntitlements],
          ["Falhas de entrega · 24h", data.deliveryFailures],
        ]
          .filter(([, value]) => value !== null)
          .map(([label, value]) => (
            <article className="admin-card" key={label}>
              <h2>{label}</h2>
              <strong className="admin-metric">{value}</strong>
            </article>
          ))}
      </div>
      <section className="admin-section">
        <h2>Pedidos recentes</h2>
        <Table headers={["Pedido", "Cliente", "Status", "Total", "Criado"]}>
          {data.recentOrders.map((order) => (
            <tr key={order.id}>
              <td>{order.id}</td>
              <td>{order.customer.email}</td>
              <td>
                <Status>{order.status}</Status>
              </td>
              <td>{money(order.totalMinor, order.currency)}</td>
              <td>{date(order.createdAt)}</td>
            </tr>
          ))}
        </Table>
      </section>
      <section className="admin-section">
        <h2>Pagamentos por estado</h2>
        <div className="admin-grid">
          {data.payments.map((item) => (
            <article className="admin-card" key={item.status}>
              <h2>{item.status}</h2>
              <strong className="admin-metric">{item._count._all}</strong>
            </article>
          ))}
        </div>
      </section>
      {data.audit.length > 0 && (
        <section className="admin-section">
          <h2>Auditoria recente</h2>
          <Table headers={["Ação", "Resultado", "Data"]}>
            {data.audit.map((item) => (
              <tr key={item.id}>
                <td>{item.action}</td>
                <td>
                  <Status>{item.outcome}</Status>
                </td>
                <td>{date(item.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </section>
      )}
    </>
  );
}
