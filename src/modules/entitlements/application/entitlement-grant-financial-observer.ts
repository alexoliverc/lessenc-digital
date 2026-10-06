import type {
  FinancialObservationObserver,
  FinancialObservationResult,
} from "../../payments/application/financial-coordinator";
import type { DispatchPendingEntitlementGrants } from "./dispatch-pending-entitlement-grants";

export class EntitlementGrantFinancialObserver implements FinancialObservationObserver {
  constructor(private readonly dispatcher: Pick<DispatchPendingEntitlementGrants, "execute">) {}

  async afterFinancialObservation(input: FinancialObservationResult): Promise<void> {
    if (input.result === "REJECTED" || input.result === "REVIEW") {
      return;
    }

    await this.dispatcher.execute(input.orderId);
  }
}
