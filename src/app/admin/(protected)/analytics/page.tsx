import { requireAdminPage } from "../../admin-access";
import { type AnalyticsDimensionRow, parseAnalyticsWindow } from "../../admin-analytics";
import { readAdminAnalytics } from "../../admin-analytics-query";
import { money, PageHeader, Table } from "../../admin-ui";

export const dynamic = "force-dynamic";

function percent(value: number): string {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
function label(value: string | null): string {
  return value ?? "Não atribuído";
}

function DimensionTable({ rows }: { rows: readonly AnalyticsDimensionRow[] }) {
  return (
    <Table
      headers={["Source", "Medium", "Campaign", "Eventos", "Jornadas", "Purchases", "Receita"]}
    >
      {rows.map((row) => (
        <tr key={`${row.source ?? ""}:${row.medium ?? ""}:${row.campaign ?? ""}`}>
          <td>{label(row.source)}</td>
          <td>{label(row.medium)}</td>
          <td>{label(row.campaign)}</td>
          <td>{row.events}</td>
          <td>{row.uniqueJourneys}</td>
          <td>{row.purchases}</td>
          <td>{money(row.revenueMinor, "BRL")}</td>
        </tr>
      ))}
    </Table>
  );
}

export default async function AdminAnalytics({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { database } = await requireAdminPage("analytics.read", true);
  const window = parseAnalyticsWindow(await searchParams);
  const report = await readAdminAnalytics(database, window);
  return (
    <>
      <PageHeader
        eyebrow="Medição canônica"
        title="Analytics"
        description="Indicadores agregados, somente leitura, derivados dos eventos internos canônicos."
      />
      <p className="admin-note">
        Período UTC: {window.from.toISOString().slice(0, 10)} até{" "}
        {new Date(window.to.getTime() - 1).toISOString().slice(0, 10)}. ROAS não é suportado sem
        fonte autoritativa de gastos de mídia.
      </p>
      <div className="admin-grid">
        {(["VIEW_CONTENT", "INITIATE_CHECKOUT", "PURCHASE"] as const).map((type) => (
          <article className="admin-card" key={type}>
            <h2>{type}</h2>
            <strong className="admin-metric">{report.events[type].events}</strong>
            <span>{report.events[type].uniqueJourneys} jornadas únicas</span>
          </article>
        ))}
        <article className="admin-card">
          <h2>Jornadas únicas</h2>
          <strong className="admin-metric">{report.uniqueJourneys}</strong>
        </article>
      </div>
      <section className="admin-section">
        <h2>Conversão por jornadas únicas</h2>
        <div className="admin-grid">
          <article className="admin-card">
            <h3>View → Checkout</h3>
            <strong className="admin-metric">{percent(report.conversions.viewToCheckout)}</strong>
          </article>
          <article className="admin-card">
            <h3>Checkout → Purchase</h3>
            <strong className="admin-metric">
              {percent(report.conversions.checkoutToPurchase)}
            </strong>
          </article>
          <article className="admin-card">
            <h3>View → Purchase</h3>
            <strong className="admin-metric">{percent(report.conversions.viewToPurchase)}</strong>
          </article>
        </div>
      </section>
      <section className="admin-section">
        <h2>Receita canônica</h2>
        <div className="admin-grid">
          <article className="admin-card">
            <h3>Total</h3>
            <strong className="admin-metric">
              {money(report.revenue.totalMinor, report.revenue.currency)}
            </strong>
          </article>
          <article className="admin-card">
            <h3>Atribuída</h3>
            <strong className="admin-metric">
              {money(report.revenue.attributedMinor, report.revenue.currency)}
            </strong>
          </article>
          <article className="admin-card">
            <h3>Não atribuída</h3>
            <strong className="admin-metric">
              {money(report.revenue.unattributedMinor, report.revenue.currency)}
            </strong>
          </article>
        </div>
      </section>
      <section className="admin-section">
        <h2>First Touch</h2>
        <DimensionTable rows={report.firstTouch} />
      </section>
      <section className="admin-section">
        <h2>Last Touch</h2>
        <DimensionTable rows={report.lastTouch} />
      </section>
    </>
  );
}
