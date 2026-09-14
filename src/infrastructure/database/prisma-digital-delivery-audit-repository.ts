import type { PrismaClient } from "../../generated/prisma/client";
import type {
  DigitalDeliveryAuditRecord,
  DigitalDeliveryAuditRepository,
} from "../../modules/entitlements/application/protected-digital-delivery";

export class PrismaDigitalDeliveryAuditRepository implements DigitalDeliveryAuditRepository {
  constructor(private readonly db: PrismaClient) {}

  async record(record: DigitalDeliveryAuditRecord): Promise<void> {
    await this.db.digitalDeliveryEvent.create({
      data: {
        entitlementId: record.entitlementId,
        resourceId: record.resourceId,
        buyerAccessCredentialId: record.buyerAccessCredentialId,
        outcome: record.outcome,
        failureCode: record.failureCode,
      },
      select: {
        id: true,
      },
    });
  }
}
