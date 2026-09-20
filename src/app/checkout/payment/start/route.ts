import { randomUUID } from "node:crypto";

import { logger } from "@/lib/observability/logger";

import { paymentServices, paymentSession } from "../payment.server";
import { noStore, parsePaymentStartInput, readSmallJson, validPaymentOrigin } from "../request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  if (!validPaymentOrigin(request))
    return Response.json({ state: "unavailable" }, { status: 403, headers: noStore });
  const claims = await paymentSession();
  if (!claims) return Response.json({ state: "expired" }, { status: 401, headers: noStore });
  let input: unknown;
  try {
    input = await readSmallJson(request);
  } catch {
    return Response.json({ state: "invalid" }, { status: 400, headers: noStore });
  }
  const data = parsePaymentStartInput(input);
  if (!data) {
    return Response.json({ state: "invalid" }, { status: 400, headers: noStore });
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
    return Response.json(result, { headers: noStore });
  } catch {
    logger.error("provider_create_ambiguous", { correlationId });
    return Response.json(
      { state: "unknown", presentation: null },
      { status: 503, headers: noStore },
    );
  }
}
