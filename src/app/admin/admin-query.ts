import type { PrismaClient, ProductStatus } from "@/generated/prisma/client";

export type AdminListQuery = Readonly<{ page: number; limit: number; search: string }>;

export function isAdminResourceId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function parseAdminListQuery(
  input: Record<string, string | string[] | undefined>,
): AdminListQuery {
  const rawPage = Array.isArray(input.page) ? input.page[0] : input.page;
  const rawLimit = Array.isArray(input.limit) ? input.limit[0] : input.limit;
  const rawSearch = Array.isArray(input.q) ? input.q[0] : input.q;
  const page = /^\d+$/u.test(rawPage ?? "") ? Number(rawPage) : 1;
  const limit = /^\d+$/u.test(rawLimit ?? "") ? Number(rawLimit) : 20;
  return Object.freeze({
    page: Math.min(Math.max(page, 1), 10_000),
    limit: Math.min(Math.max(limit, 1), 50),
    search: (rawSearch ?? "").trim().slice(0, 100),
  });
}

export async function readDashboard(
  database: PrismaClient,
  visibility: { catalog: boolean; audit: boolean },
) {
  const [
    products,
    orders,
    customers,
    activeEntitlements,
    revokedEntitlements,
    recentOrders,
    payments,
    deliveryFailures,
    audit,
  ] = await Promise.all([
    visibility.catalog ? database.product.count() : Promise.resolve(null),
    database.order.count(),
    database.customer.count(),
    database.entitlement.count({ where: { status: "ACTIVE" } }),
    database.entitlement.count({ where: { status: "REVOKED" } }),
    database.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        status: true,
        totalMinor: true,
        currency: true,
        createdAt: true,
        customer: { select: { email: true } },
      },
    }),
    database.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    database.digitalDeliveryEvent.count({
      where: { outcome: "FAILED", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } },
    }),
    visibility.audit
      ? database.adminAuditEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, action: true, outcome: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);
  return {
    products,
    orders,
    customers,
    activeEntitlements,
    revokedEntitlements,
    recentOrders,
    payments,
    deliveryFailures,
    audit,
  };
}

export async function listCatalog(database: PrismaClient, query: AdminListQuery) {
  const where = query.search ? { name: { contains: query.search } } : {};
  return database.product.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      updatedAt: true,
      offers: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { id: true, priceMinor: true, currency: true, isActive: true },
      },
    },
  });
}

export async function listOrders(database: PrismaClient, query: AdminListQuery) {
  return database.order.findMany({
    where: query.search
      ? { OR: [{ id: query.search }, { customer: { email: { contains: query.search } } }] }
      : {},
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: {
      id: true,
      status: true,
      totalMinor: true,
      currency: true,
      createdAt: true,
      customer: { select: { email: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
    },
  });
}

export async function listPayments(database: PrismaClient, query: AdminListQuery) {
  return database.payment.findMany({
    where: query.search
      ? {
          OR: [
            { id: query.search },
            { orderId: query.search },
            { providerOrderId: query.search },
            { providerPaymentId: query.search },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
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
      requiresReview: true,
      reviewReason: true,
      createdAt: true,
    },
  });
}

export async function listCustomers(database: PrismaClient, query: AdminListQuery) {
  return database.customer.findMany({
    where: query.search ? { email: { contains: query.search } } : {},
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: { id: true, email: true, createdAt: true, _count: { select: { orders: true } } },
  });
}

export async function listEntitlements(database: PrismaClient, query: AdminListQuery) {
  return database.entitlement.findMany({
    where: query.search
      ? {
          OR: [
            { id: query.search },
            { orderItem: { order: { customer: { email: { contains: query.search } } } } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: {
      id: true,
      status: true,
      sourceOutboxEventId: true,
      activatedAt: true,
      revokedAt: true,
      createdAt: true,
      orderItem: {
        select: {
          orderId: true,
          productNameSnapshot: true,
          order: { select: { customer: { select: { email: true } } } },
        },
      },
      _count: { select: { resources: true } },
    },
  });
}

export async function listDeliveries(database: PrismaClient, query: AdminListQuery) {
  return database.digitalDeliveryEvent.findMany({
    where: query.search
      ? { OR: [{ entitlementId: query.search }, { buyerAccessCredentialId: query.search }] }
      : {},
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: {
      id: true,
      entitlementId: true,
      resourceId: true,
      buyerAccessCredentialId: true,
      outcome: true,
      failureCode: true,
      createdAt: true,
      buyerAccessCredential: { select: { status: true } },
    },
  });
}

export async function listAudit(database: PrismaClient, query: AdminListQuery) {
  return database.adminAuditEvent.findMany({
    where: query.search
      ? {
          OR: [
            { action: { contains: query.search } },
            { correlationId: query.search },
            { actorAdminUserId: query.search },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    skip: (query.page - 1) * query.limit,
    take: query.limit,
    select: {
      id: true,
      action: true,
      actorRole: true,
      targetType: true,
      targetId: true,
      outcome: true,
      metadata: true,
      correlationId: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });
}

export const allowedProductStatuses: readonly ProductStatus[] = [
  "DRAFT",
  "ACTIVE",
  "INACTIVE",
  "ARCHIVED",
];

export function parseProductStatus(value: FormDataEntryValue | null): ProductStatus | null {
  return typeof value === "string" && allowedProductStatuses.includes(value as ProductStatus)
    ? (value as ProductStatus)
    : null;
}
