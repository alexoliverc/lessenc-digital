import type { AnalyticsEventRecord } from "../../attribution/application/persistence";

export type CanonicalPurchaseIneligibleReason =
  | "ORDER_NOT_FOUND"
  | "FINANCIAL_STATE_NOT_AUTHORITATIVE"
  | "AMBIGUOUS_APPROVED_PAYMENT"
  | "COMMERCIAL_SNAPSHOT_INVALID";

export type CanonicalPurchaseProjectionResult =
  | Readonly<{
      state: "CREATED" | "EXISTING";
      event: AnalyticsEventRecord;
    }>
  | Readonly<{
      state: "INELIGIBLE";
      reason: CanonicalPurchaseIneligibleReason;
    }>;

export interface CanonicalPurchaseRepository {
  project(input: { orderId: string; eventId: string }): Promise<CanonicalPurchaseProjectionResult>;

  findEligibleMissingOrderIds(limit: number): Promise<readonly string[]>;
}

export type AnalyticsIdFactory = () => string;

export class ProjectCanonicalPurchase {
  constructor(
    private readonly repository: CanonicalPurchaseRepository,
    private readonly createId: AnalyticsIdFactory,
  ) {}

  execute(orderId: string): Promise<CanonicalPurchaseProjectionResult> {
    if (orderId.trim().length === 0) {
      throw new Error("INVALID_PURCHASE_ORDER_ID");
    }

    return this.repository.project({
      orderId,
      eventId: this.createId(),
    });
  }
}

export type CanonicalPurchaseReconciliationReport = Readonly<{
  scanned: number;
  created: number;
  existing: number;
  ineligible: number;
  failed: number;
}>;

export class ReconcileCanonicalPurchases {
  constructor(
    private readonly repository: CanonicalPurchaseRepository,
    private readonly projector: ProjectCanonicalPurchase,
  ) {}

  async execute(limit = 50): Promise<CanonicalPurchaseReconciliationReport> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new Error("INVALID_PURCHASE_RECONCILIATION_LIMIT");
    }

    const orderIds = await this.repository.findEligibleMissingOrderIds(limit);
    let created = 0;
    let existing = 0;
    let ineligible = 0;
    let failed = 0;

    for (const orderId of orderIds) {
      try {
        const result = await this.projector.execute(orderId);

        if (result.state === "CREATED") {
          created += 1;
        } else if (result.state === "EXISTING") {
          existing += 1;
        } else {
          ineligible += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return Object.freeze({
      scanned: orderIds.length,
      created,
      existing,
      ineligible,
      failed,
    });
  }
}
