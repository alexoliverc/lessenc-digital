import { describe, expect, it, vi } from "vitest";

import type { AnalyticsConsentProjection } from "./consent";
import {
  synchronizeGoogleTagManager,
  type GoogleConsentCommandSink,
  type GoogleTagDataLayer,
  type GoogleTagScriptHost,
} from "./google-tag-manager-runtime";

const unknownConsent: AnalyticsConsentProjection = Object.freeze({
  analytics: "UNKNOWN",
  advertising: "UNKNOWN",
  policyVersion: "p13-architecture-freeze-r2",
});

const deniedConsent: AnalyticsConsentProjection = Object.freeze({
  analytics: "DENIED",
  advertising: "DENIED",
  policyVersion: "p13-architecture-freeze-r2",
});

const analyticsConsent: AnalyticsConsentProjection = Object.freeze({
  analytics: "GRANTED",
  advertising: "DENIED",
  policyVersion: "p13-architecture-freeze-r2",
});

const fullConsent: AnalyticsConsentProjection = Object.freeze({
  analytics: "GRANTED",
  advertising: "GRANTED",
  policyVersion: "p13-architecture-freeze-r2",
});

function harness(input?: { alreadyLoaded?: boolean; appendFailure?: boolean }) {
  const trace: string[] = [];

  const command: GoogleConsentCommandSink = vi.fn((_command, action, state) => {
    trace.push(`consent:${action}:${state.analytics_storage}:${state.ad_storage}`);
  });

  const dataLayer: GoogleTagDataLayer = {
    push: vi.fn((entry) => {
      trace.push(`dataLayer:${entry.event}:${entry["gtm.start"]}`);

      return 1;
    }),
  };

  const scripts: GoogleTagScriptHost = {
    hasScript: vi.fn(() => input?.alreadyLoaded ?? false),

    appendScript: vi.fn((script) => {
      trace.push(`script:${script.id}:${script.src}:${String(script.async)}`);

      if (input?.appendFailure) {
        throw new Error("SCRIPT_APPEND_FAILED");
      }
    }),
  };

  return {
    trace,
    command,
    dataLayer,
    scripts,
  };
}

describe("P13-F1 isolated Google Tag Manager runtime", () => {
  it("stays disabled when no GTM container is configured", () => {
    const runtime = harness();

    expect(
      synchronizeGoogleTagManager({
        containerId: null,
        consent: fullConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:30:00.000Z"),
      }),
    ).toEqual({
      state: "DISABLED",
    });

    expect(runtime.trace).toEqual([]);
  });

  it("blocks GTM completely while canonical consent is UNKNOWN", () => {
    const runtime = harness();

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: unknownConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:30:00.000Z"),
      }),
    ).toEqual({
      state: "BLOCKED_BY_CONSENT",
    });

    expect(runtime.trace).toEqual([]);
  });

  it("blocks GTM completely after explicit denial when it has never loaded", () => {
    const runtime = harness();

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: deniedConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:30:00.000Z"),
      }),
    ).toEqual({
      state: "BLOCKED_BY_CONSENT",
    });

    expect(runtime.trace).toEqual([]);
  });

  it("queues default denied then canonical update before gtm.start and script load", () => {
    const runtime = harness();

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: analyticsConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:30:00.000Z"),
      }),
    ).toEqual({
      state: "LOADED",
    });

    expect(runtime.trace).toEqual([
      "consent:default:denied:denied",
      "consent:update:granted:denied",
      "dataLayer:gtm.js:1789835400000",
      "script:lessenc-google-tag-manager:https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234:true",
    ]);
  });

  it("updates consent without duplicating gtm.start or the script after GTM is loaded", () => {
    const runtime = harness({
      alreadyLoaded: true,
    });

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: fullConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:31:00.000Z"),
      }),
    ).toEqual({
      state: "CONSENT_UPDATED",
    });

    expect(runtime.trace).toEqual(["consent:update:granted:granted"]);

    expect(runtime.scripts.appendScript).not.toHaveBeenCalled();
  });

  it("propagates a later consent withdrawal to an already-loaded GTM without reloading it", () => {
    const runtime = harness({
      alreadyLoaded: true,
    });

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: deniedConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:32:00.000Z"),
      }),
    ).toEqual({
      state: "CONSENT_UPDATED",
    });

    expect(runtime.trace).toEqual(["consent:update:denied:denied"]);

    expect(runtime.scripts.appendScript).not.toHaveBeenCalled();
  });

  it("fails isolatedly when script insertion fails", () => {
    const runtime = harness({
      appendFailure: true,
    });

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: analyticsConsent,
        command: runtime.command,
        dataLayer: runtime.dataLayer,
        scripts: runtime.scripts,
        now: () => new Date("2026-09-19T16:30:00.000Z"),
      }),
    ).toEqual({
      state: "LOAD_FAILED",
    });

    expect(runtime.trace).toEqual([
      "consent:default:denied:denied",
      "consent:update:granted:denied",
      "dataLayer:gtm.js:1789835400000",
      "script:lessenc-google-tag-manager:https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234:true",
    ]);
  });
});
