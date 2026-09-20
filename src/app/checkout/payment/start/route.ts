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
import { noStore, parsePaymentStartInput, readSmallJson, validPaymentOrigin } from "../request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = resolveRequestCorrelationId(request.headers);
  const span = startOperationalSpan({
    correlationId,
    surface: "PAYMENTS",
    operation: "PAYMENT_CREATE",
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
        operation: "PAYMENT_CREATE",
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
        operation: "PAYMENT_CREATE",
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
        operation: "PAYMENT_CREATE",
        outcome,
        method: "POST",
        statusClass: statusClass(response.status),
      },
    });
    return response;
  };

  if (!validPaymentOrigin(request))
    return finish(
      Response.json({ state: "unavailable" }, { status: 403, headers: noStore }),
      "DENIED",
      "ORIGIN_DENIED",
    );
  const claims = await paymentSession();
  if (!claims)
    return finish(
      Response.json({ state: "expired" }, { status: 401, headers: noStore }),
      "DENIED",
      "SESSION_INVALID",
    );
  let input: unknown;
  try {
    input = await readSmallJson(request);
  } catch {
    return finish(
      Response.json({ state: "invalid" }, { status: 400, headers: noStore }),
      "DENIED",
      "REQUEST_INVALID",
    );
  }
  const data = parsePaymentStartInput(input);
  if (!data) {
    return finish(
      Response.json({ state: "invalid" }, { status: 400, headers: noStore }),
      "DENIED",
      "REQUEST_INVALID",
    );
  }
  try {
    const { coordinator } = paymentServices();
    logger.info("provider_create_started", { correlationId });
    const result = await coordinator.start(
      claims.orderId,
      data.method,
      data.method === "CREDIT_CARD" ? data.card : undefined,
    );
    logger.info("provider_create_completed", { correlationId, state: result.state });
    return finish(Response.json(result, { headers: noStore }), "SUCCEEDED");
  } catch {
    logger.error("provider_create_ambiguous", { correlationId });
    return finish(
      Response.json({ state: "unknown", presentation: null }, { status: 503, headers: noStore }),
      "FAILED",
      "PAYMENT_CREATE_FAILED",
    );
  }
}
