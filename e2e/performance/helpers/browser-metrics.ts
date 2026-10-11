import type { BrowserContext, Page } from "@playwright/test";
import { PERFORMANCE_BASE_URL } from "./isolation";

export type BrowserMetricResult =
  | Readonly<{ state: "VALID"; valueMs: number }>
  | Readonly<{
      state: "INCONCLUSIVE";
      reason:
        | "API_UNAVAILABLE"
        | "OBSERVATION_NOT_FINALIZED"
        | "ENTRY_MISSING"
        | "INTERACTION_ID_MISSING"
        | "REQUEST_START_MISSING"
        | "REQUEST_CORRELATION_INVALID"
        | "TIMING_INCONSISTENT"
        | "RESOURCE_TIMING_MISSING"
        | "HTTP_STATUS_INVALID"
        | "HTTP_STATUS_MISMATCH"
        | "DELIVERY_AUDIT_NOT_PROVEN"
        | "REDIRECT_OBSERVED"
        | "NAVIGATION_FAILED"
        | "FORM_FILL_FAILED"
        | "CONSENT_SETUP_FAILED"
        | "MARK_TARGET_FAILED"
        | "CLICK_FAILED"
        | "OUTCOME_NOT_OBSERVED"
        | "OBSERVER_READ_FAILED"
        | "FIXTURE_CLEANUP_FAILED";
    }>;

export type DeliveryTimingResult =
  | Readonly<{
      state: "VALID";
      valueMs: number;
      status: 200 | 206;
    }>
  | Readonly<{
      state: "INCONCLUSIVE";
      reason:
        | "RESOURCE_TIMING_MISSING"
        | "HTTP_STATUS_INVALID"
        | "HTTP_STATUS_MISMATCH"
        | "REDIRECT_OBSERVED"
        | "TIMING_INCONSISTENT";
    }>;

type BrowserMetricState = {
  lcpSupported: boolean;
  lcpCandidateMs: number | null;
  lcpFinalized: boolean;
  finalizeLcp?: () => void;
  eventTimingSupported: boolean;
  flushEventEntries?: () => void;
  flushResourceEntries?: () => void;
  markerEvents: Array<{
    marker: string;
    name: string;
    startTimeMs: number;
  }>;
  interactions: Array<{
    marker: string;
    interactionId: number;
    durationMs: number;
    startTimeMs: number;
  }>;
  resources: Array<{
    pathname: string;
    origin?: string;
    queryPresent?: boolean;
    initiatorType: string;
    requestStartMs: number;
    responseStartMs: number;
    redirectStartMs: number;
    redirectEndMs: number;
    responseStatus: number;
  }>;
};

export type InteractionTiming = BrowserMetricState["interactions"][number];
export type ResourceTiming = BrowserMetricState["resources"][number];

declare global {
  // The object is installed before navigation and contains sanitized timing values only.
  var __p17PerformanceMetrics: BrowserMetricState | undefined;
}

function installObservers(): void {
  const state: BrowserMetricState = {
    lcpSupported: false,
    lcpCandidateMs: null,
    lcpFinalized: false,
    eventTimingSupported: false,
    markerEvents: [],
    interactions: [],
    resources: [],
  };

  globalThis.__p17PerformanceMetrics = state;

  const supported = PerformanceObserver.supportedEntryTypes;

  if (supported.includes("largest-contentful-paint")) {
    state.lcpSupported = true;
    const consumeLcpEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const candidate = entry.toJSON() as Record<string, unknown>;
        const renderTime = candidate.renderTime;
        const loadTime = candidate.loadTime;
        const value =
          typeof renderTime === "number" && renderTime > 0
            ? renderTime
            : typeof loadTime === "number" && loadTime > 0
              ? loadTime
              : entry.startTime;

        if (Number.isFinite(value) && value >= 0) {
          state.lcpCandidateMs = value;
        }
      }
    };
    const observer = new PerformanceObserver((list) => {
      consumeLcpEntries(list.getEntries());
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
    state.finalizeLcp = () => {
      consumeLcpEntries(observer.takeRecords());
      observer.disconnect();
      state.lcpFinalized = true;
    };
  }

  if (supported.includes("event")) {
    state.eventTimingSupported = true;
    for (const name of ["pointerdown", "pointerup", "click", "keydown"]) {
      addEventListener(
        name,
        (event) => {
          const marker =
            event.target instanceof Element
              ? event.target.closest("[data-p17-interaction]")?.getAttribute("data-p17-interaction")
              : null;
          if (marker) {
            state.markerEvents.push({ marker, name: event.type, startTimeMs: event.timeStamp });
          }
        },
        { capture: true },
      );
    }
    const consumeEventEntries = (entries: PerformanceEntry[]) => {
      for (const entry of entries) {
        const timing = entry as PerformanceEntry & {
          interactionId?: unknown;
          target?: EventTarget | null;
        };
        const interactionId = timing.interactionId;
        const duration = timing.duration;
        const target = timing.target;
        const directMarker =
          target instanceof Element
            ? target.closest("[data-p17-interaction]")?.getAttribute("data-p17-interaction")
            : null;
        const marker =
          directMarker ??
          state.markerEvents.find(
            (observed) =>
              observed.name === entry.name && Math.abs(observed.startTimeMs - entry.startTime) <= 1,
          )?.marker;

        if (
          marker &&
          typeof interactionId === "number" &&
          typeof duration === "number" &&
          Number.isFinite(duration) &&
          Number.isFinite(entry.startTime)
        ) {
          state.interactions.push({
            marker,
            interactionId,
            durationMs: duration,
            startTimeMs: entry.startTime,
          });
        }
      }
    };
    const observer = new PerformanceObserver((list) => {
      consumeEventEntries(list.getEntries());
    });
    const eventObserverOptions: PerformanceObserverInit & {
      durationThreshold: number;
    } = {
      type: "event",
      buffered: true,
      durationThreshold: 16,
    };

    observer.observe(eventObserverOptions);
    state.flushEventEntries = () => consumeEventEntries(observer.takeRecords());
  }

  const consumeResourceEntries = (entries: PerformanceEntry[]) => {
    for (const entry of entries) {
      const timing = entry as PerformanceResourceTiming;
      let parsed: URL;

      try {
        parsed = new URL(timing.name);
      } catch {
        continue;
      }

      const serialized = timing.toJSON() as Record<string, unknown>;
      const responseStatus = serialized.responseStatus;

      state.resources.push({
        pathname: parsed.pathname,
        origin: parsed.origin,
        queryPresent: parsed.search !== "",
        initiatorType: timing.initiatorType,
        requestStartMs: timing.requestStart,
        responseStartMs: timing.responseStart,
        redirectStartMs: timing.redirectStart,
        redirectEndMs: timing.redirectEnd,
        responseStatus: typeof responseStatus === "number" ? responseStatus : 0,
      });
    }
  };
  const resourceObserver = new PerformanceObserver((list) => {
    consumeResourceEntries(list.getEntries());
  });
  resourceObserver.observe({ type: "resource", buffered: true });
  state.flushResourceEntries = () => consumeResourceEntries(resourceObserver.takeRecords());
}

export async function installPerformanceObservers(context: BrowserContext): Promise<void> {
  await context.addInitScript(installObservers);
}

export async function settleLcpCandidate(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(
      [...document.images]
        .filter((image) => {
          const rectangle = image.getBoundingClientRect();
          return (
            rectangle.bottom > 0 &&
            rectangle.right > 0 &&
            rectangle.top < innerHeight &&
            rectangle.left < innerWidth
          );
        })
        .map((image) => image.decode()),
    );
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    globalThis.__p17PerformanceMetrics?.finalizeLcp?.();
  });
}

export async function readLcpMetric(page: Page): Promise<BrowserMetricResult> {
  const snapshot = await page.evaluate(() => {
    const state = globalThis.__p17PerformanceMetrics;
    return {
      supported: state?.lcpSupported ?? false,
      candidateMs: state?.lcpCandidateMs ?? null,
      finalized: state?.lcpFinalized ?? false,
    };
  });

  return evaluateLcpCandidate(snapshot);
}

export function evaluateLcpCandidate(
  input: Readonly<{
    supported: boolean;
    candidateMs: number | null;
    finalized?: boolean;
  }>,
): BrowserMetricResult {
  if (!input.supported) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "API_UNAVAILABLE" });
  }
  if (input.finalized !== true) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "OBSERVATION_NOT_FINALIZED" });
  }
  if (input.candidateMs === null || !Number.isFinite(input.candidateMs) || input.candidateMs < 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "ENTRY_MISSING" });
  }
  return Object.freeze({ state: "VALID", valueMs: input.candidateMs });
}

export async function markInteractionTarget(
  page: Page,
  selector: string,
  marker: string,
): Promise<void> {
  if (!/^[a-z][a-z0-9-]{2,63}$/u.test(marker)) {
    throw new Error("P17_INTERACTION_MARKER_INVALID");
  }

  await page.locator(selector).evaluate((element, value) => {
    element.setAttribute("data-p17-interaction", value);
  }, marker);
}

export async function settleInteractionEntries(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await page.waitForTimeout(50);
  await page.evaluate(() => {
    globalThis.__p17PerformanceMetrics?.flushEventEntries?.();
  });
}

export async function readInpMetric(page: Page, marker: string): Promise<BrowserMetricResult> {
  const snapshot = await page.evaluate((expectedMarker) => {
    const state = globalThis.__p17PerformanceMetrics;
    state?.flushEventEntries?.();
    return {
      supported: state?.eventTimingSupported ?? false,
      interactions: (state?.interactions ?? []).filter((entry) => entry.marker === expectedMarker),
    };
  }, marker);

  return evaluateInpEntries(snapshot);
}

export function evaluateInpEntries(
  input: Readonly<{
    supported: boolean;
    interactions: readonly InteractionTiming[];
  }>,
): BrowserMetricResult {
  if (!input.supported) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "API_UNAVAILABLE" });
  }
  if (input.interactions.length === 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "ENTRY_MISSING" });
  }
  if (
    input.interactions.some(
      (entry) => !Number.isFinite(entry.interactionId) || entry.interactionId < 0,
    )
  ) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "INTERACTION_ID_MISSING" });
  }
  const interactions = input.interactions.filter((entry) => entry.interactionId > 0);
  if (interactions.length === 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "INTERACTION_ID_MISSING" });
  }
  const byInteraction = new Map<number, number>();
  for (const entry of interactions) {
    byInteraction.set(
      entry.interactionId,
      Math.max(byInteraction.get(entry.interactionId) ?? 0, entry.durationMs),
    );
  }
  const valueMs = Math.max(...byInteraction.values());
  if (!Number.isFinite(valueMs) || valueMs < 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "TIMING_INCONSISTENT" });
  }
  return Object.freeze({ state: "VALID", valueMs });
}

export type PaymentPostCaptureSnapshot = Readonly<{
  acceptedPostCount: number;
  rejectedAttemptCount: number;
}>;

/**
 * The synthetic POST capture is mandatory for numeric acceptance.
 * Until it is connected by the PR03 spec, results remain INCONCLUSIVE.
 */
export async function readPaymentPostInitiationMetric(
  page: Page,
  marker: string,
  capture?: PaymentPostCaptureSnapshot,
): Promise<BrowserMetricResult> {
  const snapshot = await page.evaluate((expectedMarker) => {
    const state = globalThis.__p17PerformanceMetrics;
    state?.flushEventEntries?.();
    state?.flushResourceEntries?.();
    return {
      interactions: (state?.interactions ?? []).filter((entry) => entry.marker === expectedMarker),
      resources: (state?.resources ?? []).filter(
        (entry) => entry.pathname === "/checkout/payment/start" && entry.initiatorType === "fetch",
      ),
    };
  }, marker);

  return evaluateCorrelatedPaymentInitiationTiming({
    interactions: snapshot.interactions,
    resources: snapshot.resources,
    capture,
  });
}

/**
 * Requires one synthetic POST and exactly one matching Resource Timing.
 * All timestamps used for the metric originate in the browser.
 */
export function evaluateCorrelatedPaymentInitiationTiming(
  input: Readonly<{
    interactions: readonly InteractionTiming[];
    resources: readonly ResourceTiming[];
    capture?: PaymentPostCaptureSnapshot | undefined;
  }>,
): BrowserMetricResult {
  if (input.capture?.acceptedPostCount !== 1 || input.capture.rejectedAttemptCount !== 0) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });
  }

  if (
    input.interactions.length === 0 ||
    input.interactions.some(
      (entry) =>
        !Number.isFinite(entry.interactionId) ||
        entry.interactionId < 0 ||
        !Number.isFinite(entry.startTimeMs),
    )
  ) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "INTERACTION_ID_MISSING",
    });
  }

  const interactions = input.interactions.filter((entry) => entry.interactionId > 0);
  if (interactions.length === 0) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "INTERACTION_ID_MISSING",
    });
  }

  const interactionIds = new Set(interactions.map((entry) => entry.interactionId));

  if (interactionIds.size !== 1 || input.resources.length !== 1) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });
  }

  const resource = input.resources[0];

  if (
    resource === undefined ||
    resource.origin !== "http://127.0.0.1:3100" ||
    resource.pathname !== "/checkout/payment/start" ||
    resource.queryPresent !== false ||
    resource.initiatorType !== "fetch" ||
    resource.responseStatus !== 200 ||
    resource.redirectStartMs !== 0 ||
    resource.redirectEndMs !== 0
  ) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "REQUEST_CORRELATION_INVALID",
    });
  }

  const interaction = interactions.reduce((earliest, current) =>
    current.startTimeMs < earliest.startTimeMs ? current : earliest,
  );

  return evaluatePaymentInitiationTiming({ interaction, resource });
}

export function evaluatePaymentInitiationTiming(
  input: Readonly<{
    interaction: InteractionTiming | null;
    resource: ResourceTiming | null;
  }>,
): BrowserMetricResult {
  if (!input.interaction || input.interaction.interactionId <= 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "INTERACTION_ID_MISSING" });
  }
  if (!input.resource || input.resource.requestStartMs <= 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "REQUEST_START_MISSING" });
  }
  const valueMs = input.resource.requestStartMs - input.interaction.startTimeMs;
  if (!Number.isFinite(valueMs) || valueMs < 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "TIMING_INCONSISTENT" });
  }
  return Object.freeze({ state: "VALID", valueMs });
}

export function evaluateDeliveryTiming(
  input: Readonly<{
    requestStartMs: number;
    responseStartMs: number;
    redirectStartMs: number;
    redirectEndMs: number;
    responseStatus: number;
  }>,
): DeliveryTimingResult {
  if (![200, 206].includes(input.responseStatus)) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "HTTP_STATUS_INVALID" });
  }

  if (input.redirectStartMs !== 0 || input.redirectEndMs !== 0) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "REDIRECT_OBSERVED" });
  }

  const valueMs = input.responseStartMs - input.requestStartMs;
  if (
    input.requestStartMs <= 0 ||
    input.responseStartMs <= 0 ||
    !Number.isFinite(valueMs) ||
    valueMs < 0
  ) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "TIMING_INCONSISTENT" });
  }

  return Object.freeze({
    state: "VALID",
    valueMs,
    status: input.responseStatus as 200 | 206,
  });
}

export function evaluateMatchedDeliveryTiming(
  timing: ResourceTiming,
  responseStatus: number,
): DeliveryTimingResult {
  if (timing.responseStatus !== responseStatus) {
    return Object.freeze({ state: "INCONCLUSIVE", reason: "HTTP_STATUS_MISMATCH" });
  }

  return evaluateDeliveryTiming({
    ...timing,
    responseStatus,
  });
}

/**
 * Rejects missing, duplicate or foreign Resource Timing entries.
 *
 * This checks uniqueness of matching browser entries, not
 * authorization of the protected resource itself.
 */
export function evaluateUniqueDeliveryResourceTiming(
  resources: readonly ResourceTiming[],
  resourcePath: string,
  responseStatus: number,
): DeliveryTimingResult {
  let expected: URL;

  try {
    expected = new URL(resourcePath, PERFORMANCE_BASE_URL);
  } catch {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "TIMING_INCONSISTENT",
    });
  }

  if (expected.origin !== PERFORMANCE_BASE_URL || expected.search !== "" || expected.hash !== "") {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "TIMING_INCONSISTENT",
    });
  }

  const matching = resources.filter(
    (entry) =>
      entry.origin === expected.origin &&
      entry.pathname === expected.pathname &&
      entry.queryPresent === false &&
      entry.initiatorType === "fetch",
  );

  if (matching.length === 0) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "RESOURCE_TIMING_MISSING",
    });
  }

  if (matching.length !== 1) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "TIMING_INCONSISTENT",
    });
  }

  const timing = matching[0];

  if (timing === undefined) {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "RESOURCE_TIMING_MISSING",
    });
  }

  return evaluateMatchedDeliveryTiming(timing, responseStatus);
}

/**
 * Waits only for asynchronous observer delivery.
 *
 * The waiting interval is never included in the TTFB
 * calculation, which uses original browser timestamps.
 */
export async function readDeliveryTtfbMetric(
  page: Page,
  resourcePath: string,
  responseStatus: number,
): Promise<DeliveryTimingResult> {
  let expected: URL;

  try {
    expected = new URL(resourcePath, PERFORMANCE_BASE_URL);
  } catch {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "TIMING_INCONSISTENT",
    });
  }

  if (expected.origin !== PERFORMANCE_BASE_URL || expected.search !== "" || expected.hash !== "") {
    return Object.freeze({
      state: "INCONCLUSIVE",
      reason: "TIMING_INCONSISTENT",
    });
  }

  try {
    const handle = await page.waitForFunction(
      ({ pathname, origin }) => {
        const state = globalThis.__p17PerformanceMetrics;
        state?.flushResourceEntries?.();
        const resources = state?.resources ?? [];

        return resources.some(
          (entry) =>
            entry.pathname === pathname &&
            entry.origin === origin &&
            entry.queryPresent === false &&
            entry.initiatorType === "fetch",
        );
      },
      {
        pathname: expected.pathname,
        origin: expected.origin,
      },
      {
        polling: 50,
        timeout: 2_000,
      },
    );

    await handle.dispose();
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return Object.freeze({
        state: "INCONCLUSIVE",
        reason: "RESOURCE_TIMING_MISSING",
      });
    }

    throw error;
  }

  const resources = await page.evaluate(() => {
    const state = globalThis.__p17PerformanceMetrics;
    state?.flushResourceEntries?.();
    return state?.resources ?? [];
  });

  return evaluateUniqueDeliveryResourceTiming(resources, resourcePath, responseStatus);
}
