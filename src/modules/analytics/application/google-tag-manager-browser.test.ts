import { describe, expect, it, vi } from "vitest";

import {
  createGoogleTagManagerBrowserEnvironment,
  getGoogleTagDataLayer,
  type GoogleTagBrowserDocument,
  type GoogleTagBrowserScript,
  type GoogleTagBrowserWindow,
} from "./google-tag-manager-browser";
import {
  GOOGLE_TAG_MANAGER_SCRIPT_ID,
  synchronizeGoogleTagManager,
} from "./google-tag-manager-runtime";

function fakeBrowser() {
  const windowRef: GoogleTagBrowserWindow = {};

  const nodes = new Map<string, GoogleTagBrowserScript>();

  const appendChild = vi.fn((node: GoogleTagBrowserScript) => {
    nodes.set(node.id, node);

    return node;
  });

  const documentRef: GoogleTagBrowserDocument = {
    getElementById: vi.fn((id) => nodes.get(id) ?? null),

    createElement: vi.fn(() => ({
      id: "",
      src: "",
      async: false,
    })),

    head: {
      appendChild,
    },
  };

  return {
    windowRef,
    documentRef,
    nodes,
    appendChild,
  };
}

describe("P13-F1 Google Tag Manager browser bridge", () => {
  it("creates and reuses one browser dataLayer", () => {
    const browser = fakeBrowser();

    const first = getGoogleTagDataLayer(browser.windowRef);

    first.push({
      event: "first",
    });

    const second = getGoogleTagDataLayer(browser.windowRef);

    expect(second).toBe(first);

    expect(second).toEqual([
      {
        event: "first",
      },
    ]);
  });

  it("projects Google consent commands using the gtag arguments queue contract", () => {
    const browser = fakeBrowser();

    const environment = createGoogleTagManagerBrowserEnvironment({
      windowRef: browser.windowRef,
      documentRef: browser.documentRef,
    });

    environment.command("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
    });

    const entry = getGoogleTagDataLayer(browser.windowRef)[0];

    expect(Array.from(entry as IArguments)).toEqual([
      "consent",
      "default",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);
  });

  it("creates the asynchronous GTM script and then detects it as already present", () => {
    const browser = fakeBrowser();

    const environment = createGoogleTagManagerBrowserEnvironment({
      windowRef: browser.windowRef,
      documentRef: browser.documentRef,
    });

    expect(environment.scripts.hasScript(GOOGLE_TAG_MANAGER_SCRIPT_ID)).toBe(false);

    environment.scripts.appendScript({
      id: GOOGLE_TAG_MANAGER_SCRIPT_ID,
      src: "https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234",
      async: true,
    });

    expect(environment.scripts.hasScript(GOOGLE_TAG_MANAGER_SCRIPT_ID)).toBe(true);

    expect(browser.nodes.get(GOOGLE_TAG_MANAGER_SCRIPT_ID)).toEqual({
      id: GOOGLE_TAG_MANAGER_SCRIPT_ID,
      src: "https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234",
      async: true,
    });

    expect(browser.appendChild).toHaveBeenCalledTimes(1);
  });

  it("keeps UNKNOWN completely offline and loads GTM only after eligible consent", () => {
    const browser = fakeBrowser();

    const environment = createGoogleTagManagerBrowserEnvironment({
      windowRef: browser.windowRef,
      documentRef: browser.documentRef,
    });

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: {
          analytics: "UNKNOWN",
          advertising: "UNKNOWN",
        },
        ...environment,
        now: () => new Date("2026-09-19T17:00:00.000Z"),
      }),
    ).toEqual({
      state: "BLOCKED_BY_CONSENT",
    });

    expect(getGoogleTagDataLayer(browser.windowRef)).toEqual([]);

    expect(browser.appendChild).not.toHaveBeenCalled();

    expect(
      synchronizeGoogleTagManager({
        containerId: "GTM-ABC1234",
        consent: {
          analytics: "GRANTED",
          advertising: "DENIED",
        },
        ...environment,
        now: () => new Date("2026-09-19T17:01:00.000Z"),
      }),
    ).toEqual({
      state: "LOADED",
    });

    const dataLayer = getGoogleTagDataLayer(browser.windowRef);

    expect(dataLayer).toHaveLength(3);

    expect(Array.from(dataLayer[0] as IArguments).slice(0, 2)).toEqual(["consent", "default"]);

    expect(Array.from(dataLayer[1] as IArguments).slice(0, 2)).toEqual(["consent", "update"]);

    expect(dataLayer[2]).toEqual({
      "gtm.start": new Date("2026-09-19T17:01:00.000Z").getTime(),
      event: "gtm.js",
    });

    expect(browser.nodes.get(GOOGLE_TAG_MANAGER_SCRIPT_ID)?.src).toBe(
      "https://www.googletagmanager.com/gtm.js?id=GTM-ABC1234",
    );
  });
});
