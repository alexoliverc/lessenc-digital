import type { ReactNode } from "react";
import "../admin.css";
export default function AdminPublicLayout({ children }: { children: ReactNode }) {
  return <main className="admin-public">{children}</main>;
}
