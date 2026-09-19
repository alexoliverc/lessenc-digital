import type { GoogleAdsConversionDataLayerEvent } from "@/modules/analytics/application/google-ads-conversion";

import type { BuyerPaymentStatusWithAnalytics } from "./analytics-purchase";

export type CanonicalGoogleAdsConversionLoader = Readonly<{
  execute(orderId: string): Promise<GoogleAdsConversionDataLayerEvent | null>;
}>;

export type BuyerPaymentStatusWithAdvertising = BuyerPaymentStatusWithAnalytics &
  Readonly<{
    advertisingConversion: GoogleAdsConversionDataLayerEvent | null;
  }>;

export async function attachCanonicalAdvertisingConversion(
  input: Readonly<{
    orderId: string;
    payment: BuyerPaymentStatusWithAnalytics;
    loader: CanonicalGoogleAdsConversionLoader;
    onFailure?: () => void;
  }>,
): Promise<BuyerPaymentStatusWithAdvertising> {
  if (input.payment.state !== "approved") {
    return Object.freeze({
      ...input.payment,
      advertisingConversion: null,
    });
  }

  try {
    const advertisingConversion = await input.loader.execute(input.orderId);

    return Object.freeze({
      ...input.payment,
      advertisingConversion,
    });
  } catch {
    input.onFailure?.();

    return Object.freeze({
      ...input.payment,
      advertisingConversion: null,
    });
  }
}
