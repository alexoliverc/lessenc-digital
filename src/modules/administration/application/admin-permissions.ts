export type AdminRole = "OWNER" | "ADMIN" | "SUPPORT";

export const ADMIN_PERMISSIONS = [
  "admin.identity.read",
  "admin.identity.manage",
  "admin.role.manage",
  "admin.session.manage",
  "catalog.read",
  "catalog.write",
  "order.read",
  "payment.read",
  "customer.read",
  "entitlement.read",
  "delivery.read",
  "delivery.recover",
  "audit.read",
  "security.self",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const SUPPORT = [
  "order.read",
  "payment.read",
  "customer.read",
  "entitlement.read",
  "delivery.read",
  "delivery.recover",
  "security.self",
] as const satisfies readonly AdminPermission[];

const ADMIN = [
  ...SUPPORT,
  "catalog.read",
  "catalog.write",
  "audit.read",
] as const satisfies readonly AdminPermission[];

export const ADMIN_ROLE_PERMISSIONS: Readonly<Record<AdminRole, ReadonlySet<AdminPermission>>> =
  Object.freeze({
    OWNER: new Set(ADMIN_PERMISSIONS),
    ADMIN: new Set(ADMIN),
    SUPPORT: new Set(SUPPORT),
  });

export function hasAdminPermission(role: AdminRole, permission: string): boolean {
  return ADMIN_ROLE_PERMISSIONS[role]?.has(permission as AdminPermission) ?? false;
}
