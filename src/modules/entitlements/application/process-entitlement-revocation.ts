import {
  createP11CorrelationId,
  p11Observability,
} from "../../../lib/observability/p11-observability";

export type EntitlementRevocationProcessResult = "PROCESSED" | "NOOP";

export interface EntitlementRevocationRepository {
  processRefundCompleted(eventId: string): Promise<EntitlementRevocationProcessResult>;
}

export class ProcessEntitlementRevocation {
  constructor(private readonly repository: EntitlementRevocationRepository) {}

  execute(eventId: string): Promise<EntitlementRevocationProcessResult> {
    if (!eventId.trim()) {
      throw new Error("INVALID_OUTBOX_EVENT_ID");
    }

    const correlationId = createP11CorrelationId();

    return this.repository.processRefundCompleted(eventId).catch((error: unknown) => {
      p11Observability.error("entitlement_revocation_failed", {
        correlationId,
        surface: "ENTITLEMENT_REVOCATION",
        outcome: "FAILED",
        failureCode: "ENTITLEMENT_REVOCATION_FAILED",
      });

      throw error;
    });
  }
}
