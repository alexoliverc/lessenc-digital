import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { QrCodeGenerateSvgOptions } from "uqr";
import { describe, expect, it } from "vitest";

import {
  completeEnrollment,
  createEnrollmentQrDataUrl,
  createTotpVerificationPayload,
  EnrollmentSetup,
  parseEnrollmentData,
  TOTP_VERIFICATION_PATH,
} from "./admin-enrollment-setup";

const SYNTHETIC_URI =
  "otpauth://totp/Lessenc:synthetic@example.invalid?secret=JBSWY3DPEHPK3PXP&issuer=Lessenc";
const SYNTHETIC_CODES = ["synthetic-code-one", "synthetic-code-two"];

describe("administrative MFA enrollment QR", () => {
  it("turns a successful synthetic enable response into the QR enrollment UI", () => {
    const enrollment = parseEnrollmentData({
      totpURI: SYNTHETIC_URI,
      backupCodes: SYNTHETIC_CODES,
    });

    expect(enrollment).not.toBeNull();
    const markup = renderToStaticMarkup(
      createElement(EnrollmentSetup, {
        enrollment: enrollment!,
        message: "",
        onVerify: () => undefined,
      }),
    );

    expect(markup).toContain("Configurar autenticação em duas etapas");
    expect(markup).toContain("QR Code para configurar a autenticação em duas etapas");
    expect(markup).toContain("data:image/svg+xml");
  });

  it("passes the exact synthetic otpauth URI to the local QR renderer", () => {
    let receivedValue = "";
    let receivedOptions: QrCodeGenerateSvgOptions | undefined;
    let renderCount = 0;
    const renderer = (value: string, options: QrCodeGenerateSvgOptions) => {
      renderCount += 1;
      receivedValue = value;
      receivedOptions = options;
      return '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
    };
    const dataUrl = createEnrollmentQrDataUrl(SYNTHETIC_URI, renderer);

    expect(renderCount).toBe(1);
    expect(receivedValue).toBe(SYNTHETIC_URI);
    expect(receivedOptions).toMatchObject({ border: 4, ecc: "M" });
    expect(dataUrl).toMatch(/^data:image\/svg\+xml;charset=utf-8,/u);
    expect(dataUrl).not.toMatch(/^https?:/u);
  });

  it("keeps a keyboard-accessible manual fallback and recovery codes visible", () => {
    const markup = renderToStaticMarkup(
      createElement(EnrollmentSetup, {
        enrollment: { uri: SYNTHETIC_URI, codes: SYNTHETIC_CODES },
        message: "",
        onVerify: () => undefined,
      }),
    );

    expect(markup).toContain("<details");
    expect(markup).toContain("Não consegue escanear?");
    expect(markup).toContain("synthetic@example.invalid");
    expect(markup).toContain("Guarde estes códigos em um local seguro antes de continuar.");
    for (const code of SYNTHETIC_CODES) expect(markup).toContain(code);
  });

  it("keeps TOTP verification untrusted and clears enrollment before routing to admin", () => {
    expect(TOTP_VERIFICATION_PATH).toBe("/two-factor/verify-totp");
    expect(createTotpVerificationPayload("123456")).toEqual({
      code: "123456",
      trustDevice: false,
    });

    const calls: string[] = [];
    completeEnrollment(() => calls.push("clear"), {
      replace: (path) => calls.push(`replace:${path}`),
      refresh: () => calls.push("refresh"),
    });
    expect(calls).toEqual(["clear", "replace:/admin", "refresh"]);
  });

  it("rejects malformed enrollment responses instead of rendering untrusted QR content", () => {
    expect(parseEnrollmentData({ totpURI: "https://example.invalid", backupCodes: [] })).toBeNull();
    expect(parseEnrollmentData({ totpURI: SYNTHETIC_URI, backupCodes: [] })).toBeNull();
    expect(parseEnrollmentData({ totpURI: SYNTHETIC_URI, backupCodes: [123] })).toBeNull();
  });

  it("contains no external QR service, browser persistence, logging, or analytics sink", () => {
    const source = ["admin-enrollment-setup.tsx", "admin-auth-client.tsx"]
      .map((file) => readFileSync(join(process.cwd(), "src", "app", "admin", file), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/chart\.google|api\.qr|quickchart|qrserver/iu);
    expect(source).not.toMatch(/localStorage|sessionStorage/iu);
    expect(source).not.toMatch(/console\.(?:log|info|warn|error)/u);
    expect(source).not.toMatch(/analytics.*(?:uri|code|secret)/iu);
  });
});
