import type {
  FinancialObservationObserver,
  FinancialObservationResult,
} from "../../payments/application/financial-coordinator";
import type { ProjectCanonicalPurchase } from "./canonical-purchase";

export class CanonicalPurchaseFinancialObserver implements FinancialObservationObserver {
  constructor(private readonly projector: Pick<ProjectCanonicalPurchase, "execute">) {}

  async afterFinancialObservation(input: FinancialObservationResult): Promise<void> {
    if (input.result === "REJECTED" || input.result === "REVIEW") {
      return;
    }

    await this.projector.execute(input.orderId);
  }
}
