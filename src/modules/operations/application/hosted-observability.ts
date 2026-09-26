import {
  assertValidAlertRule,
  deriveAlertDeduplicationKey,
  type AlertEvaluation,
  type AlertRule,
} from "./alert-policy";

export const P16_MONITOR_IDS = ["PUBLIC_LIVENESS", "PROTECTED_READINESS"] as const;
export type P16MonitorId = (typeof P16_MONITOR_IDS)[number];

export const P16_READINESS_SECRET_REFERENCE = "P16_READINESS_TOKEN";
export const P16_STATUS_PAGE_ORIGIN = "https://status.lessenc.com.br";

export type AcceptedMonitorResponse = Readonly<{
  status: number;
  body: string;
}>;

export type HostedMonitor = Readonly<{
  id: P16MonitorId;
  method: "GET";
  url: string;
  authentication:
    | Readonly<{ kind: "NONE" }>
    | Readonly<{
        kind: "BEARER_SECRET_REFERENCE";
        environmentVariable: typeof P16_READINESS_SECRET_REFERENCE;
      }>;
  acceptedResponses: readonly AcceptedMonitorResponse[];
}>;

export type HostedMonitoringPlan = Readonly<{
  monitors: readonly HostedMonitor[];
  publicStatusOrigin: typeof P16_STATUS_PAGE_ORIGIN;
}>;

export type AlertDeliveryMessage = Readonly<{
  schemaVersion: 1;
  state: "FIRING";
  ruleId: string;
  component: AlertRule["component"];
  severity: AlertRule["severity"];
  owner: AlertRule["owner"];
  deduplicationKey: string;
  occurrenceCount: number;
  evaluatedAt: string;
}>;

export type AlertDeliveryResult = Readonly<{
  status: "ACCEPTED" | "REJECTED";
  evidenceReference?: string;
}>;

/** Provider adapters implement delivery only; they receive no commercial mutation capability. */
export interface AlertDeliveryPort {
  deliver(message: AlertDeliveryMessage): Promise<AlertDeliveryResult>;
}

/** Incident destinations consume the same sanitized evidence without internal diagnostics. */
export interface IncidentNotificationPort {
  notify(message: AlertDeliveryMessage): Promise<AlertDeliveryResult>;
}

const RULE_ID_PATTERN = /^P15-[A-Z0-9-]{1,48}$/u;
const DEDUPLICATION_KEY_PATTERN = /^[A-Z0-9:_-]{1,256}$/u;

function canonicalBaseUrl(value: string): URL {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error("INVALID_MONITORING_BASE_URL");
  }

  if (
    url.protocol !== "https:" ||
    url.origin !== "https://lessenc.com.br" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("INVALID_MONITORING_BASE_URL");
  }

  return url;
}

export function createHostedMonitoringPlan(baseUrl: string): HostedMonitoringPlan {
  const origin = canonicalBaseUrl(baseUrl);
  const livenessUrl = new URL("/api/health", origin);
  const readinessUrl = new URL("/api/readiness", origin);

  return Object.freeze({
    monitors: Object.freeze([
      Object.freeze({
        id: "PUBLIC_LIVENESS",
        method: "GET",
        url: livenessUrl.toString(),
        authentication: Object.freeze({ kind: "NONE" }),
        acceptedResponses: Object.freeze([Object.freeze({ status: 200, body: '{"status":"ok"}' })]),
      }),
      Object.freeze({
        id: "PROTECTED_READINESS",
        method: "GET",
        url: readinessUrl.toString(),
        authentication: Object.freeze({
          kind: "BEARER_SECRET_REFERENCE",
          environmentVariable: P16_READINESS_SECRET_REFERENCE,
        }),
        acceptedResponses: Object.freeze([
          Object.freeze({ status: 200, body: '{"status":"ready"}' }),
          Object.freeze({ status: 503, body: '{"status":"not_ready"}' }),
        ]),
      }),
    ]),
    publicStatusOrigin: P16_STATUS_PAGE_ORIGIN,
  });
}

export function prepareAlertDelivery(
  rule: AlertRule,
  evaluation: AlertEvaluation,
  evaluatedAt: Date,
): AlertDeliveryMessage | null {
  assertValidAlertRule(rule);
  let expectedDeduplicationKey: string;

  try {
    expectedDeduplicationKey = deriveAlertDeduplicationKey(rule, evaluation.partition);
  } catch {
    throw new Error("INVALID_ALERT_DELIVERY_INPUT");
  }

  const shouldFire = evaluation.count >= rule.threshold;
  if (
    typeof evaluation.firing !== "boolean" ||
    !RULE_ID_PATTERN.test(rule.id) ||
    !(evaluatedAt instanceof Date) ||
    !Number.isFinite(evaluatedAt.getTime()) ||
    evaluation.severity !== rule.severity ||
    evaluation.owner !== rule.owner ||
    !Number.isSafeInteger(evaluation.count) ||
    evaluation.count < 0 ||
    !DEDUPLICATION_KEY_PATTERN.test(evaluation.deduplicationKey) ||
    evaluation.deduplicationKey !== expectedDeduplicationKey ||
    evaluation.firing !== shouldFire
  ) {
    throw new Error("INVALID_ALERT_DELIVERY_INPUT");
  }

  if (!evaluation.firing) return null;

  return Object.freeze({
    schemaVersion: 1,
    state: "FIRING",
    ruleId: rule.id,
    component: rule.component,
    severity: rule.severity,
    owner: rule.owner,
    deduplicationKey: evaluation.deduplicationKey,
    occurrenceCount: evaluation.count,
    evaluatedAt: evaluatedAt.toISOString(),
  });
}
