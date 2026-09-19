import type {
  GoogleConsentCommandSink,
  GoogleTagDataLayer,
  GoogleTagScriptHost,
} from "./google-tag-manager-runtime";

export type GoogleTagBrowserWindow = {
  dataLayer?: unknown[];
};

export type GoogleTagBrowserScript = {
  id: string;
  src: string;
  async: boolean;
};

export type GoogleTagBrowserDocument = {
  getElementById(id: string): unknown | null;

  createElement(tagName: "script"): GoogleTagBrowserScript;

  head: {
    appendChild(node: GoogleTagBrowserScript): unknown;
  };
};

export function getGoogleTagDataLayer(
  windowRef: GoogleTagBrowserWindow = globalThis.window as unknown as GoogleTagBrowserWindow,
): unknown[] {
  windowRef.dataLayer = windowRef.dataLayer ?? [];

  return windowRef.dataLayer;
}

export function createGoogleTagManagerBrowserEnvironment(
  input: {
    windowRef?: GoogleTagBrowserWindow;
    documentRef?: GoogleTagBrowserDocument;
  } = {},
): Readonly<{
  command: GoogleConsentCommandSink;
  dataLayer: GoogleTagDataLayer;
  scripts: GoogleTagScriptHost;
}> {
  const windowRef = input.windowRef ?? (globalThis.window as unknown as GoogleTagBrowserWindow);

  const documentRef =
    input.documentRef ?? (globalThis.document as unknown as GoogleTagBrowserDocument);

  const command: GoogleConsentCommandSink = (...args) => {
    getGoogleTagDataLayer(windowRef).push(args);
  };

  const dataLayer: GoogleTagDataLayer = {
    push(entry) {
      return getGoogleTagDataLayer(windowRef).push(entry);
    },
  };

  const scripts: GoogleTagScriptHost = {
    hasScript(scriptId) {
      return documentRef.getElementById(scriptId) !== null;
    },

    appendScript(inputScript) {
      const script = documentRef.createElement("script");

      script.id = inputScript.id;
      script.src = inputScript.src;
      script.async = inputScript.async;

      documentRef.head.appendChild(script);
    },
  };

  return Object.freeze({
    command,
    dataLayer,
    scripts,
  });
}
