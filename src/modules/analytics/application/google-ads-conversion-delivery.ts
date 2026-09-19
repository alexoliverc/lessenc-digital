import type { AnalyticsEventRepository } from "../../attribution/application/persistence";
import {
  projectGoogleAdsCanonicalPurchase,
  type GoogleAdsConversionDataLayerEvent,
} from "./google-ads-conversion";

export class LoadGoogleAdsCanonicalConversionForBrowser {
  constructor(
    private readonly repository: Pick<AnalyticsEventRepository, "findPurchaseByOrderKey">,
  ) {}

  async execute(orderId: string): Promise<GoogleAdsConversionDataLayerEvent | null> {
    const canonicalOrderId = orderId.trim();

    if (canonicalOrderId.length === 0) {
      throw new Error("INVALID_GOOGLE_ADS_DELIVERY_ORDER_ID");
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
      throw new Error("GOOGLE_ADS_DELIVERY_ORDER_MISMATCH");
    }

    return projectGoogleAdsCanonicalPurchase(event);
  }
}
