import {
  hasAdminPermission,
  type AdminRole,
} from "@/modules/administration/application/admin-permissions";

export const ADMIN_NAVIGATION = [
  ["Dashboard", "/admin", undefined],
  ["Catálogo", "/admin/catalog", "catalog.read"],
  ["Pedidos", "/admin/orders", "order.read"],
  ["Pagamentos", "/admin/payments", "payment.read"],
  ["Clientes", "/admin/customers", "customer.read"],
  ["Entitlements", "/admin/entitlements", "entitlement.read"],
  ["Entregas", "/admin/deliveries", "delivery.read"],
  ["Auditoria", "/admin/audit", "audit.read"],
  ["Conta e segurança", "/admin/account", "security.self"],
] as const;

export function adminNavigationFor(role: AdminRole) {
  return ADMIN_NAVIGATION.filter(
    ([, , permission]) => !permission || hasAdminPermission(role, permission),
  );
}
