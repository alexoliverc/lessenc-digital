import type { Page, Request, Response, Route } from "@playwright/test";

import { parsePaymentStartInput } from "../../../src/app/checkout/payment/request.ts";
import { PERFORMANCE_BASE_URL } from "./isolation.ts";
import { PERFORMANCE_CALIBRATION_ORIGIN } from "./network-profile.ts";

const localGetPaths = [
  "/",
  "/api/analytics/consent",
  "/cronograma-capilar-inteligente",
  "/checkout",
  "/checkout/payment",
] as const;

const exactLocalGetPatterns = [
  /^\/_next\//u,
  /^\/api\/buyer-access\/resources\/[0-9a-f-]{36}$/u,
] as const;

const calibrationPaths = new Set([
  "/calibration/download",
  "/calibration/upload",
  "/calibration/rtt",
]);

export type GuardDecision =
  | Readonly<{ state: "ALLOW" }>
  | Readonly<{
      state: "REJECT";
      reason:
        | "ORIGIN_NOT_ALLOWED"
        | "LOCAL_PATH_NOT_ALLOWED"
        | "METHOD_NOT_ALLOWED"
        | "CALIBRATION_PATH_NOT_ALLOWED"
        | "PAYMENT_ENDPOINT_SYNTHETIC_ONLY";
    }>;

export function inspectPerformanceRequest(
  input: Readonly<{
    rawUrl: string;
    method: string;
  }>,
): GuardDecision {
  let parsed: URL;

  try {
    parsed = new URL(input.rawUrl);
  } catch {
    return Object.freeze({ state: "REJECT", reason: "ORIGIN_NOT_ALLOWED" });
  }

  if (parsed.origin === PERFORMANCE_CALIBRATION_ORIGIN) {
    if (!calibrationPaths.has(parsed.pathname)) {
      return Object.freeze({ state: "REJECT", reason: "CALIBRATION_PATH_NOT_ALLOWED" });
    }

    const allowedMethod =
      (parsed.pathname === "/calibration/upload" && input.method === "POST") ||
      (parsed.pathname !== "/calibration/upload" && input.method === "GET");

    return allowedMethod
      ? Object.freeze({ state: "ALLOW" })
      : Object.freeze({ state: "REJECT", reason: "METHOD_NOT_ALLOWED" });
  }

  if (parsed.origin !== PERFORMANCE_BASE_URL) {
    return Object.freeze({ state: "REJECT", reason: "ORIGIN_NOT_ALLOWED" });
  }

  if (input.method === "GET") {
    const allowed =
      localGetPaths.includes(parsed.pathname as (typeof localGetPaths)[number]) ||
      exactLocalGetPatterns.some((pattern) => pattern.test(parsed.pathname));

    return allowed
      ? Object.freeze({ state: "ALLOW" })
      : Object.freeze({ state: "REJECT", reason: "LOCAL_PATH_NOT_ALLOWED" });
  }

  // Financial endpoints must never fall through to the real backend.
  // An explicitly installed synthetic Playwright route may fulfill
  // the payment-start request; the default guard must reject it.
  if (
    parsed.pathname === "/checkout/payment/start" ||
    parsed.pathname === "/checkout/payment/status"
  ) {
    return Object.freeze({
      state: "REJECT",
      reason: "PAYMENT_ENDPOINT_SYNTHETIC_ONLY",
    });
  }

  if (input.method === "POST" && parsed.pathname === "/checkout") {
    return Object.freeze({ state: "ALLOW" });
  }

  if (input.method === "POST" && parsed.pathname === "/api/analytics/consent") {
    return Object.freeze({ state: "ALLOW" });
  }

  return Object.freeze({ state: "REJECT", reason: "METHOD_NOT_ALLOWED" });
}

export async function denyOptionalMeasurement(
  page: Page,
  options: Readonly<{ requireReturnPageBoundary?: boolean }> = {},
): Promise<void> {
  const returnUrl = page.url();
  const acquisitionResponse = await page.goto("/cronograma-capilar-inteligente", {
    waitUntil: "domcontentloaded",
  });
  if (acquisitionResponse?.status() !== 200) {
    throw new Error("P17_PERFORMANCE_ACQUISITION_SETUP_FAILED");
  }

  const projection = await page.evaluate(async () => {
    const response = await fetch("/api/analytics/consent", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ analytics: "DENIED", advertising: "DENIED" }),
    });
    const body: unknown = await response.json();
    return { ok: response.ok, status: response.status, body };
  });

  if (!projection.ok) {
    switch (projection.status) {
      case 403:
        throw new Error("P17_PERFORMANCE_CONSENT_ORIGIN_REJECTED");
      case 409:
        throw new Error("P17_PERFORMANCE_CONSENT_JOURNEY_UNAVAILABLE");
      case 503:
        throw new Error("P17_PERFORMANCE_CONSENT_SERVICE_UNAVAILABLE");
      default:
        throw new Error("P17_PERFORMANCE_CONSENT_PROJECTION_INVALID");
    }
  }

  if (
    !projection.body ||
    typeof projection.body !== "object" ||
    Array.isArray(projection.body) ||
    !("analytics" in projection.body) ||
    !("advertising" in projection.body) ||
    projection.body.analytics !== "DENIED" ||
    projection.body.advertising !== "DENIED"
  ) {
    throw new Error("P17_PERFORMANCE_CONSENT_PROJECTION_INVALID");
  }

  const returnResponse = await page.goto(returnUrl, { waitUntil: "domcontentloaded" });
  if (returnResponse?.status() !== 200) {
    throw new Error("P17_PERFORMANCE_CONSENT_RETURN_NAVIGATION_FAILED");
  }
  if (options.requireReturnPageBoundary === false) return;

  await page.waitForFunction(() => {
    const element = document.querySelector<HTMLDetailsElement>(
      'aside[aria-label="Preferências de privacidade"] details',
    );
    return element?.open === false;
  });
}

function decisionForRequest(request: Request): GuardDecision {
  return inspectPerformanceRequest({
    rawUrl: request.url(),
    method: request.method(),
  });
}

export async function installPerformanceRequestGuard(page: Page): Promise<void> {
  await page.route("**/*", async (route: Route) => {
    const decision = decisionForRequest(route.request());

    if (decision.state === "ALLOW") {
      await route.continue();
      return;
    }

    await route.abort("blockedbyclient");
  });
}

export type SyntheticPaymentStartCapture = Readonly<{
  snapshot(): Readonly<{
    expectedFlow: "PIX" | "CREDIT_CARD";
    matchedPostCount: number;
    methodMismatchCount: number;
    rejectedAttemptCount: number;
  }>;
}>;

export function inspectSyntheticPaymentStartResponse(
  input: Readonly<{ rawUrl: string; method: string; status: number }>,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(input.rawUrl);
  } catch {
    return false;
  }
  return (
    parsed.origin === PERFORMANCE_BASE_URL &&
    parsed.pathname === "/checkout/payment/start" &&
    parsed.search === "" &&
    input.method === "POST" &&
    input.status === 200
  );
}

export async function observeSyntheticPaymentStartAction(
  page: Page,
  action: () => Promise<void>,
): Promise<void> {
  const observedResponse = page.waitForResponse(
    (response) =>
      inspectSyntheticPaymentStartResponse({
        rawUrl: response.url(),
        method: response.request().method(),
        status: response.status(),
      }),
    { timeout: 10_000 },
  );

  await action();
  const response: Response = await observedResponse;
  const failure = await response.finished();
  if (failure !== null) throw new Error("P17_SYNTHETIC_PAYMENT_RESPONSE_FAILED");
}

export type SyntheticPaymentMethodDecision =
  | Readonly<{ state: "MATCH"; flow: "PIX" | "CREDIT_CARD" }>
  | Readonly<{ state: "REJECT"; reason: "PAYLOAD_INVALID" | "METHOD_MISMATCH" }>;

/**
 * Validates the request with the production parser and retains only the method classification.
 * Card tokens and the rest of the financial payload are deliberately never returned or stored.
 */
export function inspectSyntheticPaymentStartBody(
  body: unknown,
  expectedFlow: "PIX" | "CREDIT_CARD",
): SyntheticPaymentMethodDecision {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Object.freeze({ state: "REJECT", reason: "PAYLOAD_INVALID" });
  }

  const parsed = parsePaymentStartInput(body);
  if (parsed === null) {
    return Object.freeze({ state: "REJECT", reason: "PAYLOAD_INVALID" });
  }

  if (parsed.method !== expectedFlow) {
    return Object.freeze({ state: "REJECT", reason: "METHOD_MISMATCH" });
  }

  return Object.freeze({ state: "MATCH", flow: expectedFlow });
}

/**
 * Records only synthetic route handling counts.
 * A snapshot is not proof of Resource Timing or payment execution.
 */
export async function fulfillSyntheticPaymentStart(
  page: Page,
  expectedFlow: "PIX" | "CREDIT_CARD",
): Promise<SyntheticPaymentStartCapture> {
  let matchedPostCount = 0;
  let methodMismatchCount = 0;
  let rejectedAttemptCount = 0;

  await page.route(`${PERFORMANCE_BASE_URL}/checkout/payment/start`, async (route) => {
    const request = route.request();

    if (request.method() !== "POST") {
      rejectedAttemptCount += 1;
      await route.abort("blockedbyclient");
      return;
    }

    let body: unknown;

    try {
      body = request.postDataJSON();
    } catch {
      rejectedAttemptCount += 1;
      await route.abort("blockedbyclient");
      return;
    }

    const decision = inspectSyntheticPaymentStartBody(body, expectedFlow);
    if (decision.state === "REJECT") {
      if (decision.reason === "METHOD_MISMATCH") methodMismatchCount += 1;
      else rejectedAttemptCount += 1;
      await route.abort("blockedbyclient");
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "Cache-Control": "no-store, private",
        "Referrer-Policy": "no-referrer",
      },
      body: JSON.stringify({
        state: "awaiting_payment",
        presentation: null,
        analyticsPurchase: null,
        advertisingConversion: null,
        metaPixelPurchase: null,
      }),
    });

    matchedPostCount += 1;
  });

  return Object.freeze({
    snapshot: () =>
      Object.freeze({
        expectedFlow,
        matchedPostCount,
        methodMismatchCount,
        rejectedAttemptCount,
      }),
  });
}

/**
 * Installs only the Payment Brick interface exercised by PaymentChoice. The real provider script
 * remains blocked by the request guard, so no Mercado Pago request, credential or mutation exists.
 */
export async function installSyntheticCardBrick(page: Page): Promise<void> {
  await page.addInitScript(() => {
    class SyntheticMercadoPago {
      bricks() {
        return {
          async create(name: string, id: string, settings: Readonly<Record<string, unknown>>) {
            if (name !== "cardPayment") {
              throw new Error("P17_SYNTHETIC_BRICK_NAME_INVALID");
            }

            const callbacks = settings.callbacks as
              | Readonly<{
                  onReady?: () => void;
                  onSubmit?: (form: unknown, additional: unknown) => Promise<void>;
                }>
              | undefined;
            const mount = document.getElementById(id);

            if (!mount || !callbacks?.onSubmit) {
              throw new Error("P17_SYNTHETIC_BRICK_CONTRACT_INVALID");
            }

            const button = document.createElement("button");
            button.type = "button";
            button.textContent = "Enviar cartão sintético";
            button.setAttribute("data-p17-synthetic-card-submit", "true");
            button.addEventListener("click", () => {
              void callbacks.onSubmit?.(
                {
                  token: "p17_synthetic_card_token",
                  payment_method_id: "visa",
                  installments: 1,
                },
                { paymentTypeId: "credit_card" },
              );
            });
            mount.append(button);
            callbacks.onReady?.();

            return {
              unmount() {
                button.remove();
              },
            };
          },
        };
      }
    }

    Object.defineProperty(globalThis, "MercadoPago", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: SyntheticMercadoPago,
    });
  });
}

export async function signalSyntheticSdkReady(page: Page): Promise<void> {
  await page.waitForSelector('script[src="https://sdk.mercadopago.com/js/v2"]', {
    state: "attached",
  });
  await page.evaluate(() => {
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.mercadopago.com/js/v2"]',
    );
    if (!script) throw new Error("P17_SYNTHETIC_BRICK_SCRIPT_ELEMENT_MISSING");
    script.dispatchEvent(new Event("load"));
  });
}
