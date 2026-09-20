import type { PrismaClient, ProductStatus } from "@/generated/prisma/client";
import { createCorrelationId } from "@/lib/observability/correlation";
import { recordAdminDenial, runCriticalAdminMutation } from "./admin-audit";
import { AdminAccessDenied, type AdminSubject } from "./admin-subject";

export async function changeProductStatus(input: {
  database: PrismaClient;
  subject: AdminSubject;
  productId: string;
  status: ProductStatus;
  correlationId?: string;
}) {
  const correlationId = input.correlationId ?? createCorrelationId();
  try {
    return await runCriticalAdminMutation({
      database: input.database,
      subject: input.subject,
      permission: "catalog.write",
      action: "PRODUCT_STATUS_CHANGED",
      targetType: "Product",
      targetId: input.productId,
      correlationId,
      mutate: (transaction) =>
        transaction.product.update({
          where: { id: input.productId },
          data: { status: input.status },
          select: { id: true, status: true },
        }),
    });
  } catch (error) {
    if (error instanceof AdminAccessDenied) {
      await recordAdminDenial({
        database: input.database,
        subject: input.subject,
        action: "PRODUCT_STATUS_CHANGE_DENIED",
        targetType: "Product",
        targetId: input.productId,
        correlationId,
        reasonCode: "ACCESS_DENIED",
      });
    }
    throw error;
  }
}
