import type { AnalyticsEventRepository } from "../../attribution/application/persistence";
import {
  projectMetaPixelCanonicalPurchase,
  type MetaPixelPurchaseDataLayerEvent,
} from "./meta-pixel";

export class LoadMetaPixelCanonicalPurchaseForBrowser {
  constructor(
    private readonly repository: Pick<AnalyticsEventRepository, "findPurchaseByOrderKey">,
  ) {}

  async execute(orderId: string): Promise<MetaPixelPurchaseDataLayerEvent | null> {
    const canonicalOrderId = orderId.trim();

    if (canonicalOrderId.length === 0) {
      throw new Error("INVALID_META_PIXEL_DELIVERY_ORDER_ID");
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
      throw new Error("META_PIXEL_DELIVERY_ORDER_MISMATCH");
    }

    return projectMetaPixelCanonicalPurchase(event);
  }
}
