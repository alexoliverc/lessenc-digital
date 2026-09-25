"use client";

import Image from "next/image";
import { useMemo, type FormEvent } from "react";
import { renderSVG, type QrCodeGenerateSvgOptions } from "uqr";

const QR_OPTIONS: QrCodeGenerateSvgOptions = {
  border: 4,
  boostEcc: true,
  ecc: "M",
  pixelSize: 8,
};

export const TOTP_VERIFICATION_PATH = "/two-factor/verify-totp";

type QrRenderer = (value: string, options: QrCodeGenerateSvgOptions) => string;

export type EnrollmentData = {
  uri: string;
  codes: string[];
};

export function createTotpVerificationPayload(code: FormDataEntryValue | null) {
  return { code, trustDevice: false as const };
}

export function completeEnrollment(
  clearEnrollment: () => void,
  router: { replace: (path: string) => void; refresh: () => void },
) {
  clearEnrollment();
  router.replace("/admin");
  router.refresh();
}

export function parseEnrollmentData(value: unknown): EnrollmentData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as { totpURI?: unknown; backupCodes?: unknown };
  if (typeof data.totpURI !== "string" || !data.totpURI.startsWith("otpauth://totp/")) return null;
  if (
    !Array.isArray(data.backupCodes) ||
    data.backupCodes.length === 0 ||
    !data.backupCodes.every((code) => typeof code === "string" && code.length > 0)
  )
    return null;
  return { uri: data.totpURI, codes: [...data.backupCodes] };
}

export function createEnrollmentQrDataUrl(
  totpUri: string,
  renderer: QrRenderer = renderSVG,
): string {
  const svg = renderer(totpUri, QR_OPTIONS);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function EnrollmentSetup({
  enrollment,
  message,
  onVerify,
}: {
  enrollment: EnrollmentData;
  message: string;
  onVerify: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const qrDataUrl = useMemo(() => createEnrollmentQrDataUrl(enrollment.uri), [enrollment.uri]);

  return (
    <div className="admin-enrollment">
      <section aria-labelledby="admin-enrollment-heading">
        <h2 id="admin-enrollment-heading">Configurar autenticação em duas etapas</h2>
        <p>Abra seu aplicativo autenticador e escaneie este QR Code.</p>
        <p className="admin-enrollment-apps">
          Compatível com Google Authenticator, Microsoft Authenticator e outros aplicativos TOTP.
        </p>
        <figure className="admin-enrollment-qr">
          <Image
            alt="QR Code para configurar a autenticação em duas etapas"
            height={320}
            src={qrDataUrl}
            unoptimized
            width={320}
          />
          <figcaption>Configuração local para o aplicativo autenticador.</figcaption>
        </figure>
        <details className="admin-enrollment-manual">
          <summary>Não consegue escanear?</summary>
          <p>Use esta configuração manual no aplicativo autenticador:</p>
          <code>{enrollment.uri}</code>
        </details>
      </section>

      <section className="admin-recovery-codes" aria-labelledby="admin-recovery-heading">
        <h2 id="admin-recovery-heading">Códigos de recuperação</h2>
        <p>
          <strong>Guarde estes códigos em um local seguro antes de continuar.</strong> Cada código
          pode ser usado uma única vez.
        </p>
        <ul>
          {enrollment.codes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
      </section>

      <form className="admin-auth-form" onSubmit={onVerify}>
        <label>
          Código do autenticador
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6}"
            maxLength={6}
          />
        </label>
        {message && <p role="alert">{message}</p>}
        <button type="submit">Concluir configuração</button>
      </form>
    </div>
  );
}
