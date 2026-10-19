import { createCorrelationId } from "../../../lib/observability/correlation";
import { logger } from "../../../lib/observability/logger";
import type {
  FinancialObservationObserver,
  FinancialObservationResult,
} from "./financial-coordinator";

export type IndependentFinancialObserver = Readonly<{
  observer: FinancialObservationObserver;
  failureEvent: "canonical_purchase_projection_failed" | "entitlement_grant_dispatch_failed";
  failureCode: "CANONICAL_PURCHASE_PROJECTION_FAILED" | "ENTITLEMENT_GRANT_DISPATCH_FAILED";
}>;

export class IndependentFinancialObservers implements FinancialObservationObserver {
  private readonly observers: readonly IndependentFinancialObserver[];

  constructor(observers: readonly IndependentFinancialObserver[]) {
    this.observers = Object.freeze([...observers]);
  }

  async afterFinancialObservation(input: FinancialObservationResult): Promise<void> {
    for (const entry of this.observers) {
      try {
        await entry.observer.afterFinancialObservation(input);
      } catch {
        logger.error(entry.failureEvent, {
          correlationId: createCorrelationId(),
          surface: "PAYMENTS",
          outcome: "DEGRADED",
          failureCode: entry.failureCode,
        });
      }
    }
  }
}
