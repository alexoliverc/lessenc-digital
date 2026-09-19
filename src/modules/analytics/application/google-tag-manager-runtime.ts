import type { AnalyticsConsentProjection } from "./consent";
import {
  GOOGLE_CONSENT_DEFAULT_DENIED,
  isGoogleTagEligible,
  projectGoogleConsentMode,
  type GoogleConsentModeState,
} from "./google-consent-mode";

const GTM_CONTAINER_PATTERN = /^GTM-[A-Z0-9]+$/;

export const GOOGLE_TAG_MANAGER_SCRIPT_ID = "lessenc-google-tag-manager";

export type GoogleConsentCommandSink = (
  command: "consent",
  action: "default" | "update",
  state: GoogleConsentModeState,
) => void;

export type GoogleTagDataLayerEntry = Readonly<{
  event: "gtm.js";
  "gtm.start": number;
}>;

export interface GoogleTagDataLayer {
  push(entry: GoogleTagDataLayerEntry): unknown;
}

export interface GoogleTagScriptHost {
  hasScript(scriptId: string): boolean;

  appendScript(input: { id: string; src: string; async: true }): void;
}

export type GoogleTagRuntimeResult =
  | Readonly<{
      state: "DISABLED";
    }>
  | Readonly<{
      state: "BLOCKED_BY_CONSENT";
    }>
  | Readonly<{
      state: "LOADED";
    }>
  | Readonly<{
      state: "CONSENT_UPDATED";
    }>
  | Readonly<{
      state: "LOAD_FAILED";
    }>;

function validateContainerId(containerId: string): void {
  if (!GTM_CONTAINER_PATTERN.test(containerId)) {
    throw new Error("INVALID_GTM_CONTAINER_ID");
  }
}

function googleTagManagerSource(containerId: string): string {
  return "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(containerId);
}

export function synchronizeGoogleTagManager(input: {
  containerId: string | null;
  consent: Pick<AnalyticsConsentProjection, "analytics" | "advertising">;
  command: GoogleConsentCommandSink;
  dataLayer: GoogleTagDataLayer;
  scripts: GoogleTagScriptHost;
  now: () => Date;
}): GoogleTagRuntimeResult {
  if (input.containerId === null) {
    return Object.freeze({
      state: "DISABLED",
    });
  }

  validateContainerId(input.containerId);

  const projectedConsent = projectGoogleConsentMode(input.consent);

  if (input.scripts.hasScript(GOOGLE_TAG_MANAGER_SCRIPT_ID)) {
    input.command("consent", "update", projectedConsent);

    return Object.freeze({
      state: "CONSENT_UPDATED",
    });
  }

  if (!isGoogleTagEligible(input.consent)) {
    return Object.freeze({
      state: "BLOCKED_BY_CONSENT",
    });
  }

  const now = input.now();

  if (Number.isNaN(now.getTime())) {
    throw new Error("INVALID_GTM_RUNTIME_TIME");
  }

  /*
   * Basic Consent Mode:
   *
   * No Google resource is loaded before the user becomes eligible.
   * Once eligible, consent commands are queued before gtm.js starts.
   */
  input.command("consent", "default", GOOGLE_CONSENT_DEFAULT_DENIED);

  input.command("consent", "update", projectedConsent);

  input.dataLayer.push(
    Object.freeze({
      "gtm.start": now.getTime(),
      event: "gtm.js",
    }),
  );

  try {
    input.scripts.appendScript({
      id: GOOGLE_TAG_MANAGER_SCRIPT_ID,
      src: googleTagManagerSource(input.containerId),
      async: true,
    });
  } catch {
    return Object.freeze({
      state: "LOAD_FAILED",
    });
  }

  return Object.freeze({
    state: "LOADED",
  });
}
