import { randomUUID } from "node:crypto";

import { verifyMercadoPagoWebhook } from "@/infrastructure/payments/mercado-pago-webhook-verifier";
import { readBoundedText } from "@/infrastructure/http/read-bounded-text";
import { logger } from "@/lib/observability/logger";
import { paymentServices } from "@/app/checkout/payment/payment.server";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  logger.info("webhook_received", { correlationId });
  const url = new URL(request.url);
  if (
    url.searchParams.getAll("type").length !== 1 ||
    url.searchParams.getAll("data.id").length !== 1 ||
    url.searchParams.get("type") !== "order"
  ) {
    return new Response(null, { status: 400, headers });
  }
  const dataId = url.searchParams.get("data.id");
  const signature = request.headers.get("x-signature");
  const requestId = request.headers.get("x-request-id");
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret || !verifyMercadoPagoWebhook({ dataId, signature, requestId, secret })) {
    logger.warn("webhook_invalid_signature", { correlationId });
    return new Response(null, { status: 401, headers });
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 8192) return new Response(null, { status: 413, headers });
  let body: unknown;
  try {
    const raw = await readBoundedText(request.body, 8192);
    body = JSON.parse(raw);
  } catch (error) {
    return new Response(null, {
      status: error instanceof Error && error.message === "BODY_TOO_LARGE" ? 413 : 400,
      headers,
    });
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
    return new Response(null, { status: 400, headers });
  }
  try {
    const { coordinator } = paymentServices();
    const result = await coordinator.webhook(dataId!);
    logger.info(result === "NOOP" ? "webhook_duplicate" : "webhook_applied", {
      correlationId,
      result,
    });
    return new Response(null, { status: 200, headers });
  } catch {
    logger.error("webhook_failed", { correlationId });
    return new Response(null, { status: 503, headers });
  }
}
