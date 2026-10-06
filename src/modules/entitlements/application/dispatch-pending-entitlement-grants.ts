import type {
  EntitlementGrantProcessResult,
  ProcessEntitlementGrant,
} from "./process-entitlement-grant";

export const ENTITLEMENT_GRANT_DISPATCH_LIMIT = 8;

export type PendingPaymentApprovedEvent = Readonly<{
  id: string;
}>;

export interface PendingPaymentApprovedEventRepository {
  findPendingPaymentApproved(
    orderId: string,
    limit: number,
  ): Promise<readonly PendingPaymentApprovedEvent[]>;
}

export type EntitlementGrantDispatchResult = Readonly<{
  selected: number;
  processed: number;
  noop: number;
}>;

export class DispatchPendingEntitlementGrants {
  constructor(
    private readonly events: PendingPaymentApprovedEventRepository,
    private readonly processor: Pick<ProcessEntitlementGrant, "execute">,
  ) {}

  async execute(orderId: string): Promise<EntitlementGrantDispatchResult> {
    if (!orderId.trim()) {
      throw new Error("INVALID_ORDER_ID");
    }

    const selected = (
      await this.events.findPendingPaymentApproved(orderId, ENTITLEMENT_GRANT_DISPATCH_LIMIT)
    ).slice(0, ENTITLEMENT_GRANT_DISPATCH_LIMIT);

    let processed = 0;
    let noop = 0;

    for (const event of selected) {
      const result: EntitlementGrantProcessResult = await this.processor.execute(event.id);

      if (result === "PROCESSED") {
        processed += 1;
      } else {
        noop += 1;
      }
    }

    return Object.freeze({
      selected: selected.length,
      processed,
      noop,
    });
  }
}
