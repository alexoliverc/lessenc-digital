import {
  resolveRequestCorrelationId,
  setCorrelationResponseHeader,
} from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import {
  recordOperationalMetric,
  startOperationalSpan,
  statusClass,
  type OperationalOutcome,
} from "@/lib/observability/telemetry";

import { paymentServices, paymentSession } from "../payment.server";
import { noStore, validPaymentOrigin } from "../request";
import { attachCanonicalAdvertisingConversion } from "./advertising-conversion";
import { attachCanonicalAnalyticsPurchase } from "./analytics-purchase";
import { attachCanonicalMetaPixelPurchase } from "./meta-pixel-purchase";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = resolveRequestCorrelationId(request.headers);
  const span = startOperationalSpan({
    correlationId,
    surface: "PAYMENTS",
    operation: "PAYMENT_STATUS",
  });
  const finish = (
    response: Response,
    outcome: OperationalOutcome,
    failureCode?: string,
  ): Response => {
    setCorrelationResponseHeader(response.headers, correlationId);
    recordOperationalMetric({
      name: "payment_operations_total",
      value: 1,
      correlationId,
      labels: {
        surface: "PAYMENTS",
        operation: "PAYMENT_STATUS",
        outcome,
        method: "POST",
        statusClass: statusClass(response.status),
      },
    });
    recordOperationalMetric({
      name: "http_requests_total",
      value: 1,
      correlationId,
      labels: {
        surface: "PAYMENTS",
        operation: "PAYMENT_STATUS",
        outcome,
        method: "POST",
        statusClass: statusClass(response.status),
      },
    });
    const completed = span.end({
      outcome,
      ...(failureCode === undefined ? {} : { failureCode }),
    });
    recordOperationalMetric({
      name: "http_request_duration_ms",
      value: completed.durationMs,
      correlationId,
      labels: {
        surface: "PAYMENTS",
        operation: "PAYMENT_STATUS",
        outcome,
        method: "POST",
        statusClass: statusClass(response.status),
      },
    });
    return response;
  };

  if (!validPaymentOrigin(request)) {
    return finish(
      Response.json(
        {
          state: "unavailable",
        },
        {
          status: 403,
          headers: noStore,
        },
      ),
      "DENIED",
      "ORIGIN_DENIED",
    );
  }

  const claims = await paymentSession();

  if (!claims) {
    return finish(
      Response.json(
        {
          state: "expired",
        },
        {
          status: 401,
          headers: noStore,
        },
      ),
      "DENIED",
      "SESSION_INVALID",
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

    return finish(
      Response.json(result, {
        headers: noStore,
      }),
      "SUCCEEDED",
    );
  } catch {
    logger.error("payment_reconciliation_failed", {
      correlationId,
    });

    return finish(
      Response.json(
        {
          state: "unknown",
          presentation: null,
        },
        {
          status: 503,
          headers: noStore,
        },
      ),
      "FAILED",
      "PAYMENT_RECONCILIATION_FAILED",
    );
  }
}
