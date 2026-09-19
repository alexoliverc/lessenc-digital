import {
  META_CAPI_TRANSMISSION_BLOCK_REASON,
  type MetaCapiCanonicalPurchaseCore,
  type MetaCapiTransmissionBlockReason,
} from "./meta-conversions-api";

export type MetaCapiServerConfigurationInput = Readonly<{
  pixelId?: string | null;

  accessToken?: string | null;
}>;

export type MetaCapiServerConfigurationState =
  | Readonly<{
      state: "DISABLED";
    }>
  | Readonly<{
      state: "MISCONFIGURED";

      missing: "PIXEL_ID" | "ACCESS_TOKEN";
    }>
  | Readonly<{
      state: "CONFIGURED";

      pixelId: string;

      /*
       * Presence is reported, but the credential
       * itself is never returned by this inspection
       * boundary.
       */
      accessTokenPresent: true;
    }>;

export type MetaCapiBlockedDispatch = Readonly<{
  state: "BLOCKED_POLICY";

  reason: MetaCapiTransmissionBlockReason;

  eventId: string;

  /*
   * Configuration is intentionally not inspected
   * while policy blocks transmission.
   */
  configurationInspected: false;
}>;

function normalized(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const result = value.trim();

  return result.length > 0 ? result : null;
}

/*
 * This function inspects only whether server credentials
 * are structurally configured.
 *
 * It never returns the access-token value.
 */
export function inspectMetaCapiServerConfiguration(
  input: MetaCapiServerConfigurationInput,
): MetaCapiServerConfigurationState {
  const pixelId = normalized(input.pixelId);

  const accessToken = normalized(input.accessToken);

  if (pixelId === null && accessToken === null) {
    return Object.freeze({
      state: "DISABLED" as const,
    });
  }

  if (pixelId === null) {
    return Object.freeze({
      state: "MISCONFIGURED" as const,

      missing: "PIXEL_ID" as const,
    });
  }

  if (accessToken === null) {
    return Object.freeze({
      state: "MISCONFIGURED" as const,

      missing: "ACCESS_TOKEN" as const,
    });
  }

  return Object.freeze({
    state: "CONFIGURED" as const,

    pixelId,

    accessTokenPresent: true as const,
  });
}

export type MetaCapiConfigurationLoader = () => MetaCapiServerConfigurationState;

/*
 * Current P13 MVP transport kill-switch.
 *
 * Policy evaluation happens before configuration lookup.
 * Therefore even a correctly configured Pixel ID and access
 * token cannot cause CAPI transmission while the canonical
 * core remains MATCHING_DATA_POLICY_NOT_AUTHORIZED.
 *
 * There is intentionally:
 * - no HTTP client;
 * - no SDK call;
 * - no Graph endpoint;
 * - no request builder;
 * - no user_data;
 * - no request-context auto-fill.
 */
export function evaluateMetaCapiTransportBoundary(
  input: Readonly<{
    core: MetaCapiCanonicalPurchaseCore;

    loadConfiguration: MetaCapiConfigurationLoader;
  }>,
): MetaCapiBlockedDispatch {
  if (input.core.transmission.state !== "BLOCKED") {
    throw new Error("META_CAPI_UNAUTHORIZED_TRANSMISSION_STATE");
  }

  if (input.core.transmission.reason !== META_CAPI_TRANSMISSION_BLOCK_REASON) {
    throw new Error("META_CAPI_UNKNOWN_BLOCK_REASON");
  }

  /*
   * Do not call input.loadConfiguration().
   * Policy denial has precedence over credentials.
   */
  return Object.freeze({
    state: "BLOCKED_POLICY" as const,

    reason: input.core.transmission.reason,

    eventId: input.core.eventId,

    configurationInspected: false as const,
  });
}
