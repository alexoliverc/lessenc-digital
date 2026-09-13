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
