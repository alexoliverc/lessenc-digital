import type { Ga4DataLayerEvent } from "@/modules/analytics/application/google-analytics-4";
import type { BuyerPaymentState } from "@/modules/payments/application/financial-coordinator";

export type CanonicalPurchaseBrowserLoader = Readonly<{
  execute(orderId: string): Promise<Ga4DataLayerEvent | null>;
}>;

export type BuyerPaymentStatusWithAnalytics = BuyerPaymentState &
  Readonly<{
    analyticsPurchase: Ga4DataLayerEvent | null;
  }>;

export async function attachCanonicalAnalyticsPurchase(
  input: Readonly<{
    orderId: string;
    payment: BuyerPaymentState;
    loader: CanonicalPurchaseBrowserLoader;
    onFailure?: () => void;
  }>,
): Promise<BuyerPaymentStatusWithAnalytics> {
  if (input.payment.state !== "approved") {
    return Object.freeze({
      ...input.payment,
      analyticsPurchase: null,
    });
  }

  try {
    const analyticsPurchase = await input.loader.execute(input.orderId);

    return Object.freeze({
      ...input.payment,
      analyticsPurchase,
    });
  } catch {
    input.onFailure?.();

    return Object.freeze({
      ...input.payment,
      analyticsPurchase: null,
    });
  }
}
