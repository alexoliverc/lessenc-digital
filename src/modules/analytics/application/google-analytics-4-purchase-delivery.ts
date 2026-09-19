import type { AnalyticsEventRepository } from "../../attribution/application/persistence";
import { projectGa4CanonicalPurchase, type Ga4DataLayerEvent } from "./google-analytics-4";

export class LoadGa4CanonicalPurchaseForBrowser {
  constructor(
    private readonly repository: Pick<AnalyticsEventRepository, "findPurchaseByOrderKey">,
  ) {}

  async execute(orderId: string): Promise<Ga4DataLayerEvent | null> {
    const canonicalOrderId = orderId.trim();

    if (canonicalOrderId.length === 0) {
      throw new Error("INVALID_GA4_PURCHASE_DELIVERY_ORDER_ID");
    }

    const event = await this.repository.findPurchaseByOrderKey(canonicalOrderId);

    if (event === null) {
      return null;
    }

    if (
      event.type !== "PURCHASE" ||
      event.orderId !== canonicalOrderId ||
      event.purchaseOrderKey !== canonicalOrderId
    ) {
      throw new Error("GA4_PURCHASE_DELIVERY_ORDER_MISMATCH");
    }

    if (event.consentSnapshot.analytics !== "GRANTED") {
      return null;
    }

    return projectGa4CanonicalPurchase(event);
  }
}
