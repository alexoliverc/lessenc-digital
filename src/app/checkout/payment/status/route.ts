import { randomUUID } from "node:crypto";

import { logger } from "@/lib/observability/logger";

import { paymentServices, paymentSession } from "../payment.server";
import { noStore, validPaymentOrigin } from "../request";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  if (!validPaymentOrigin(request))
    return Response.json({ state: "unavailable" }, { status: 403, headers: noStore });
  const claims = await paymentSession();
  if (!claims) return Response.json({ state: "expired" }, { status: 401, headers: noStore });
  try {
    const { coordinator } = paymentServices();
    const result = await coordinator.status(claims.orderId);
    return Response.json(result, { headers: noStore });
  } catch {
    logger.error("payment_reconciliation_failed", { correlationId });
    return Response.json(
      { state: "unknown", presentation: null },
      { status: 503, headers: noStore },
    );
  }
}
