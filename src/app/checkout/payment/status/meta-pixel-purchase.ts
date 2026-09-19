import type { MetaPixelPurchaseDataLayerEvent } from "@/modules/analytics/application/meta-pixel";

import type { BuyerPaymentStatusWithAdvertising } from "./advertising-conversion";

export type CanonicalMetaPixelPurchaseLoader = Readonly<{
  execute(orderId: string): Promise<MetaPixelPurchaseDataLayerEvent | null>;
}>;

export type BuyerPaymentStatusWithMetaPixel = BuyerPaymentStatusWithAdvertising &
  Readonly<{
    metaPixelPurchase: MetaPixelPurchaseDataLayerEvent | null;
  }>;

export async function attachCanonicalMetaPixelPurchase(
  input: Readonly<{
    orderId: string;
    payment: BuyerPaymentStatusWithAdvertising;
    loader: CanonicalMetaPixelPurchaseLoader;
    onFailure?: () => void;
  }>,
): Promise<BuyerPaymentStatusWithMetaPixel> {
  if (input.payment.state !== "approved") {
    return Object.freeze({
      ...input.payment,
      metaPixelPurchase: null,
    });
  }

  try {
    const metaPixelPurchase = await input.loader.execute(input.orderId);

    return Object.freeze({
      ...input.payment,
      metaPixelPurchase,
    });
  } catch {
    input.onFailure?.();

    return Object.freeze({
      ...input.payment,
      metaPixelPurchase: null,
    });
  }
}
