export function validPaymentOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const appUrl = process.env.APP_URL;
  if (!origin || !appUrl || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}

export type PaymentStartInput =
  | Readonly<{ method: "PIX" }>
  | Readonly<{
      method: "CREDIT_CARD";
      card: Readonly<{
        token: string;
        paymentMethodId: string;
        installments: 1;
        paymentType: "credit_card";
      }>;
    }>;

export function parsePaymentStartInput(input: unknown): PaymentStartInput | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;

  if (data.method === "PIX") {
    return Object.keys(data).length === 1 ? { method: "PIX" } : null;
  }

  if (
    data.method !== "CREDIT_CARD" ||
    Object.keys(data).sort().join(",") !== "card,method" ||
    !data.card ||
    typeof data.card !== "object" ||
    Array.isArray(data.card)
  ) {
    return null;
  }

  const card = data.card as Record<string, unknown>;
  if (
    Object.keys(card).sort().join(",") !== "installments,paymentMethodId,paymentType,token" ||
    typeof card.token !== "string" ||
    card.token.length < 4 ||
    card.token.length > 2048 ||
    typeof card.paymentMethodId !== "string" ||
    !/^[A-Za-z0-9_-]{2,40}$/u.test(card.paymentMethodId) ||
    card.installments !== 1 ||
    card.paymentType !== "credit_card"
  ) {
    return null;
  }

  return {
    method: "CREDIT_CARD",
    card: {
      token: card.token,
      paymentMethodId: card.paymentMethodId,
      installments: 1,
      paymentType: "credit_card",
    },
  };
}

export async function readSmallJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("BAD_CONTENT_TYPE");
  const size = Number(request.headers.get("content-length"));
  if (Number.isFinite(size) && size > 4096) throw new Error("BODY_TOO_LARGE");
  const body = await readBoundedText(request.body, 4096);
  return JSON.parse(body);
}

export const noStore = { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" };
import { readBoundedText } from "@/infrastructure/http/read-bounded-text";
