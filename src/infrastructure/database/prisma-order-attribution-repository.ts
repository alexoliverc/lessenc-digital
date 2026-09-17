import type { PrismaClient } from "../../generated/prisma/client";
import type {
  CreateOrderAttributionSnapshot,
  OrderAttributionRecord,
  OrderAttributionRepository,
} from "../../modules/attribution/application/persistence";

function toRecord(
  row: Readonly<{
    id: string;
    orderId: string;
    journeyId: string | null;
    firstTouchId: string | null;
    lastTouchId: string | null;
    firstSource: string | null;
    firstMedium: string | null;
    firstCampaign: string | null;
    firstContent: string | null;
    firstTerm: string | null;
    lastSource: string | null;
    lastMedium: string | null;
    lastCampaign: string | null;
    lastContent: string | null;
    lastTerm: string | null;
    capturedAt: Date;
  }>,
): OrderAttributionRecord {
  return Object.freeze({
    id: row.id,
    orderId: row.orderId,
    journeyId: row.journeyId,
    firstTouchId: row.firstTouchId,
    lastTouchId: row.lastTouchId,
    firstSource: row.firstSource,
    firstMedium: row.firstMedium,
    firstCampaign: row.firstCampaign,
    firstContent: row.firstContent,
    firstTerm: row.firstTerm,
    lastSource: row.lastSource,
    lastMedium: row.lastMedium,
    lastCampaign: row.lastCampaign,
    lastContent: row.lastContent,
    lastTerm: row.lastTerm,
    capturedAt: row.capturedAt,
  });
}

export class PrismaOrderAttributionRepository implements OrderAttributionRepository {
  constructor(private readonly db: PrismaClient) {}

  async createSnapshot(input: CreateOrderAttributionSnapshot): Promise<OrderAttributionRecord> {
    const row = await this.db.orderAttribution.create({
      data: {
        id: input.id,
        orderId: input.orderId,
        journeyId: input.journeyId,
        firstTouchId: input.firstTouchId,
        lastTouchId: input.lastTouchId,
        firstSource: input.firstSource,
        firstMedium: input.firstMedium,
        firstCampaign: input.firstCampaign,
        firstContent: input.firstContent,
        firstTerm: input.firstTerm,
        lastSource: input.lastSource,
        lastMedium: input.lastMedium,
        lastCampaign: input.lastCampaign,
        lastContent: input.lastContent,
        lastTerm: input.lastTerm,
        capturedAt: input.capturedAt,
      },
    });

    return toRecord(row);
  }

  async findByOrderId(orderId: string): Promise<OrderAttributionRecord | null> {
    const row = await this.db.orderAttribution.findUnique({
      where: {
        orderId,
      },
    });

    return row ? toRecord(row) : null;
  }
}
