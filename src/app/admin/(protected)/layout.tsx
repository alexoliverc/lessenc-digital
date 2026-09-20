import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminPage } from "../admin-access";
import { LogoutButton } from "../admin-auth-client";
import { AdminNav } from "../admin-nav-client";
import { adminNavigationFor } from "../admin-navigation";
import "../admin.css";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const { subject, user } = await requireAdminPage();
  return (
    <div className="admin-shell">
      <a className="admin-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          L&apos;Essenc <small>Admin</small>
        </Link>
        <AdminNav items={adminNavigationFor(subject.role)} />
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-user">
            <strong>{user.name}</strong>
            <span>
              {user.email} · {subject.role}
            </span>
          </div>
          <LogoutButton />
        </header>
        <main className="admin-content" id="conteudo">
          {children}
        </main>
      </div>
    </div>
  );
}
