import { randomUUID } from "node:crypto";

import { logger } from "@/lib/observability/logger";

import { paymentServices, paymentSession } from "../payment.server";
import { noStore, readSmallJson, validPaymentOrigin } from "../request";

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
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return Response.json({ state: "invalid" }, { status: 400, headers: noStore });
  }
  const data = input as Record<string, unknown>;
  let card:
    | { token: string; paymentMethodId: string; installments: 1; paymentType: "credit_card" }
    | undefined;
  if (data.method === "CREDIT_CARD") {
    const source =
      data.card && typeof data.card === "object" && !Array.isArray(data.card)
        ? (data.card as Record<string, unknown>)
        : null;
    if (
      !source ||
      Object.keys(source).sort().join(",") !== "installments,paymentMethodId,paymentType,token" ||
      typeof source.token !== "string" ||
      source.token.length < 4 ||
      source.token.length > 2048 ||
      typeof source.paymentMethodId !== "string" ||
      !/^[A-Za-z0-9_-]{2,40}$/u.test(source.paymentMethodId) ||
      source.installments !== 1 ||
      source.paymentType !== "credit_card"
    ) {
      return Response.json({ state: "invalid" }, { status: 400, headers: noStore });
    }
    card = {
      token: source.token,
      paymentMethodId: source.paymentMethodId,
      installments: 1,
      paymentType: "credit_card",
    };
  } else if (data.method !== "PIX" || Object.keys(data).length !== 1) {
    return Response.json({ state: "invalid" }, { status: 400, headers: noStore });
  }
  try {
    const { coordinator } = paymentServices();
    logger.info("provider_create_started", { correlationId });
    const result = await coordinator.start(claims.orderId, data.method, card);
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
