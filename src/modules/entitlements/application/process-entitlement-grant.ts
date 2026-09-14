export type EntitlementGrantProcessResult = "PROCESSED" | "NOOP";

export interface EntitlementGrantRepository {
  processPaymentApproved(eventId: string): Promise<EntitlementGrantProcessResult>;
}

export class ProcessEntitlementGrant {
  constructor(private readonly repository: EntitlementGrantRepository) {}

  execute(eventId: string): Promise<EntitlementGrantProcessResult> {
    if (!eventId.trim()) {
      throw new Error("INVALID_OUTBOX_EVENT_ID");
    }

    return this.repository.processPaymentApproved(eventId);
  }
}
