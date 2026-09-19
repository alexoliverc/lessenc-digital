import type { AnalyticsEventRecord } from "../../attribution/application/persistence";
import {
  evaluateMetaCapiTransportBoundary,
  type MetaCapiConfigurationLoader,
} from "./meta-conversions-api-boundary";
import { projectMetaCapiCanonicalPurchaseCore } from "./meta-conversions-api";
import type {
  ProviderDispatchPolicyGate,
  ProviderDispatchTarget,
  ProviderSuppressionDecision,
} from "./provider-dispatch";

export const META_CAPI_DISPATCH_TARGET: ProviderDispatchTarget = Object.freeze({
  provider: "meta",

  channel: "capi",

  consentRequirement: "ADVERTISING",

  maxAttempts: 3,

  baseBackoffMs: 1_000,

  maxBackoffMs: 10_000,
});

export class MetaCapiDispatchPolicyGate implements ProviderDispatchPolicyGate {
  constructor(private readonly loadConfiguration: MetaCapiConfigurationLoader) {}

  evaluate(event: AnalyticsEventRecord): ProviderSuppressionDecision | null {
    if (event.type !== "PURCHASE") {
      return Object.freeze({
        errorCode: "META_CAPI_EVENT_UNSUPPORTED",

        errorClass: "PROVIDER_POLICY",
      });
    }

    const core = projectMetaCapiCanonicalPurchaseCore(event);

    if (core === null) {
      return Object.freeze({
        errorCode: "CANONICAL_META_NOT_ELIGIBLE",

        errorClass: "CONSENT_POLICY",
      });
    }

    const boundary = evaluateMetaCapiTransportBoundary({
      core,

      loadConfiguration: this.loadConfiguration,
    });

    return Object.freeze({
      errorCode: boundary.reason,

      errorClass: "PRIVACY_POLICY",
    });
  }
}
