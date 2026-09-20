import { verifyMercadoPagoWebhook } from "@/infrastructure/payments/mercado-pago-webhook-verifier";
import { readBoundedText } from "@/infrastructure/http/read-bounded-text";
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
import { paymentServices } from "@/app/checkout/payment/payment.server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const correlationId = resolveRequestCorrelationId(request.headers);
  const span = startOperationalSpan({
    correlationId,
    surface: "WEBHOOK",
    operation: "WEBHOOK_PROCESS",
  });
  const finish = (
    response: Response,
    outcome: OperationalOutcome,
    failureCode?: string,
  ): Response => {
    setCorrelationResponseHeader(response.headers, correlationId);
    recordOperationalMetric({
      name: "webhook_operations_total",
      value: 1,
      correlationId,
      labels: {
        surface: "WEBHOOK",
        operation: "WEBHOOK_PROCESS",
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
        surface: "WEBHOOK",
        operation: "WEBHOOK_PROCESS",
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
        surface: "WEBHOOK",
        operation: "WEBHOOK_PROCESS",
        outcome,
        method: "POST",
        statusClass: statusClass(response.status),
      },
    });
    return response;
  };
  logger.info("webhook_received", { correlationId });
  const url = new URL(request.url);
  if (
    url.searchParams.getAll("type").length !== 1 ||
    url.searchParams.getAll("data.id").length !== 1 ||
    url.searchParams.get("type") !== "order"
  ) {
    return finish(new Response(null, { status: 400, headers }), "DENIED", "REQUEST_INVALID");
  }
  const dataId = url.searchParams.get("data.id");
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !verifyMercadoPagoWebhook({ dataId, signature, requestId, secret })) {
    logger.warn("webhook_invalid_signature", { correlationId });
    return finish(new Response(null, { status: 401, headers }), "DENIED", "SIGNATURE_INVALID");
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 8192)
    return finish(new Response(null, { status: 413, headers }), "DENIED", "REQUEST_TOO_LARGE");
  let body: unknown;
  try {
    const raw = await readBoundedText(request.body, 8192);
    body = JSON.parse(raw);
  } catch (error) {
    return finish(
      new Response(null, {
        status: error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400,
        headers,
      }),
      "DENIED",
      error instanceof Error && error.message === "BODY_TOO_LARGE"
        ? "REQUEST_TOO_LARGE"
        : "REQUEST_INVALID",
    );
  }
  const envelope =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  const data =
    envelope?.data && typeof envelope.data === "object" && !Array.isArray(envelope.data)
      ? (envelope.data as Record<string, unknown>)
      : null;
  if (envelope?.type !== "order" || (data?.id !== undefined && data.id !== dataId)) {
    return finish(new Response(null, { status: 400, headers }), "DENIED", "REQUEST_INVALID");
  }
  try {
    const { coordinator } = paymentServices();
    const result = await coordinator.webhook(dataId!);
    logger.info(result === "NOOP" ? "webhook_duplicate" : "webhook_applied", {
      correlationId,
      result,
    });
    return finish(new Response(null, { status: 200, headers }), "SUCCEEDED");
  } catch {
    logger.error("webhook_failed", { correlationId });
    return finish(new Response(null, { status: 503, headers }), "FAILED", "WEBHOOK_FAILED");
  }
}
