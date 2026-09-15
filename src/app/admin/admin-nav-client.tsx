"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({
  items,
}: {
  items: readonly (readonly [string, string, string | undefined])[];
}) {
  const pathname = usePathname();
  return (
    <nav className="admin-nav" aria-label="Navegação administrativa">
      {items.map(([label, href]) => {
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
        return (
          <Link href={href} key={href} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
