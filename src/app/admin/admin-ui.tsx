import Link from "next/link";
import type { ReactNode } from "react";

export function money(minor: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(minor / 100);
}

export function date(value: Date | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value)
    : "—";
}

export function PageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="admin-page-header">
      <p>{eyebrow}</p>
      <h1>{title}</h1>
      <span>{description}</span>
    </header>
  );
}

export function SearchForm({
  value = "",
  placeholder = "Buscar",
}: {
  value?: string;
  placeholder?: string;
}) {
  return (
    <form className="admin-search" role="search">
      <label htmlFor="admin-search">Busca</label>
      <input
        id="admin-search"
        name="q"
        defaultValue={value}
        maxLength={100}
        placeholder={placeholder}
      />
      <button type="submit">Buscar</button>
    </form>
  );
}

export function Status({ children }: { children: ReactNode }) {
  return <span className="admin-status">{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="admin-empty">
      <strong>Nenhum registro encontrado</strong>
      <p>{children}</p>
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="admin-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function DetailLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="admin-detail-link" href={href}>
      {children}
    </Link>
  );
}
