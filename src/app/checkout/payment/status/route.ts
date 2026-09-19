import { randomUUID } from "node:crypto";

import { logger } from "@/lib/observability/logger";

import { paymentServices, paymentSession } from "../payment.server";
import { noStore, validPaymentOrigin } from "../request";
import { attachCanonicalAdvertisingConversion } from "./advertising-conversion";
import { attachCanonicalAnalyticsPurchase } from "./analytics-purchase";
import { attachCanonicalMetaPixelPurchase } from "./meta-pixel-purchase";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = randomUUID();

  if (!validPaymentOrigin(request)) {
    return Response.json(
      {
        state: "unavailable",
      },
      {
        status: 403,
        headers: noStore,
      },
    );
  }

  const claims = await paymentSession();

  if (!claims) {
    return Response.json(
      {
        state: "expired",
      },
      {
        status: 401,
        headers: noStore,
      },
    );
  }

  try {
    const {
      coordinator,
      analyticsPurchaseDelivery,
      googleAdsConversionDelivery,
      metaPixelPurchaseDelivery,
    } = paymentServices();

    const payment = await coordinator.status(claims.orderId);

    const analyticsResult = await attachCanonicalAnalyticsPurchase({
      orderId: claims.orderId,
      payment,
      loader: analyticsPurchaseDelivery,
      onFailure: () => {
        logger.error("analytics_purchase_delivery_failed", {
          correlationId,
        });
      },
    });

    const advertisingResult = await attachCanonicalAdvertisingConversion({
      orderId: claims.orderId,
      payment: analyticsResult,
      loader: googleAdsConversionDelivery,
      onFailure: () => {
        logger.error("google_ads_conversion_delivery_failed", {
          correlationId,
        });
      },
    });

    const result = await attachCanonicalMetaPixelPurchase({
      orderId: claims.orderId,
      payment: advertisingResult,
      loader: metaPixelPurchaseDelivery,
      onFailure: () => {
        logger.error("meta_pixel_purchase_delivery_failed", {
          correlationId,
        });
      },
    });

    return Response.json(result, {
      headers: noStore,
    });
  } catch {
    logger.error("payment_reconciliation_failed", {
      correlationId,
    });

    return Response.json(
      {
        state: "unknown",
        presentation: null,
      },
      {
        status: 503,
        headers: noStore,
      },
    );
  }
}
