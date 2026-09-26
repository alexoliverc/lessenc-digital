import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { evaluateAlertWindow, P15_ALERT_RULES } from "./alert-policy";
import {
  createHostedMonitoringPlan,
  P16_READINESS_SECRET_REFERENCE,
  P16_STATUS_PAGE_ORIGIN,
  prepareAlertDelivery,
} from "./hosted-observability";

const RUNTIME_TYPESCRIPT_SOURCE_PATTERN = /\.(?:ts|tsx)$/u;
const TEST_TYPESCRIPT_SOURCE_PATTERN = /\.(?:integration|spec|test)\.(?:ts|tsx)$/u;

function isRuntimeTypeScriptSource(fileName: string): boolean {
  return (
    RUNTIME_TYPESCRIPT_SOURCE_PATTERN.test(fileName) &&
    !TEST_TYPESCRIPT_SOURCE_PATTERN.test(fileName) &&
    !fileName.endsWith(".d.ts")
  );
}

function runtimeSources(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return runtimeSources(path);
    return isRuntimeTypeScriptSource(entry.name) ? [path] : [];
  });
}

describe("P16-06 hosted observability foundation", () => {
  it("defines public liveness and header-authenticated readiness without a token in either URL", () => {
    const plan = createHostedMonitoringPlan("https://lessenc.com.br");

    expect(plan).toEqual({
      monitors: [
        {
          id: "PUBLIC_LIVENESS",
          method: "GET",
          url: "https://lessenc.com.br/api/health",
          authentication: { kind: "NONE" },
          acceptedResponses: [{ status: 200, body: '{"status":"ok"}' }],
        },
        {
          id: "PROTECTED_READINESS",
          method: "GET",
          url: "https://lessenc.com.br/api/readiness",
          authentication: {
            kind: "BEARER_SECRET_REFERENCE",
            environmentVariable: P16_READINESS_SECRET_REFERENCE,
          },
          acceptedResponses: [
            { status: 200, body: '{"status":"ready"}' },
            { status: 503, body: '{"status":"not_ready"}' },
          ],
        },
      ],
      publicStatusOrigin: P16_STATUS_PAGE_ORIGIN,
    });

    for (const monitor of plan.monitors) {
      const url = new URL(monitor.url);
      expect(url.search).toBe("");
      expect(url.username).toBe("");
      expect(url.password).toBe("");
    }
    expect(JSON.stringify(plan)).not.toContain("Bearer ");

    const readiness = plan.monitors.find((monitor) => monitor.id === "PROTECTED_READINESS")!;
    expect(readiness.acceptedResponses).toContainEqual({
      status: 200,
      body: '{"status":"ready"}',
    });
    expect(readiness.acceptedResponses).toContainEqual({
      status: 503,
      body: '{"status":"not_ready"}',
    });
    expect(readiness.acceptedResponses).not.toContainEqual({
      status: 200,
      body: '{"status":"not_ready"}',
    });
    expect(readiness.acceptedResponses).not.toContainEqual({
      status: 503,
      body: '{"status":"ready"}',
    });
  });

  it.each([
    "http://lessenc.com.br",
    "https://user:secret@lessenc.com.br",
    "https://lessenc.com.br/staging",
    "https://lessenc.com.br/?token=secret",
    "https://lessenc.com.br/#authorization",
  ])("rejects an unsafe monitoring base URL: %s", (baseUrl) => {
    expect(() => createHostedMonitoringPlan(baseUrl)).toThrow("INVALID_MONITORING_BASE_URL");
  });

  it("projects a firing evaluation into a deterministic provider-neutral delivery message", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-DELIVERY-AUDIT-UNAVAILABLE",
    )!;
    const evaluatedAt = new Date("2026-09-26T12:00:00.000Z");
    const evaluation = evaluateAlertWindow(
      rule,
      [
        {
          event: "delivery_audit_unavailable",
          failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
          occurredAt: evaluatedAt,
        },
      ],
      evaluatedAt,
    );

    expect(prepareAlertDelivery(rule, evaluation, evaluatedAt)).toEqual({
      schemaVersion: 1,
      state: "FIRING",
      ruleId: "P15-DELIVERY-AUDIT-UNAVAILABLE",
      component: "BUYER_ACCESS_DELIVERY",
      severity: "CRITICAL",
      owner: "OWNER_ON_CALL",
      deduplicationKey: "P15-DELIVERY-AUDIT-UNAVAILABLE:BUYER_ACCESS_DELIVERY",
      occurrenceCount: 1,
      evaluatedAt: "2026-09-26T12:00:00.000Z",
    });
  });

  it("returns null only for a consistent non-firing evaluation", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-STORAGE-ROOT-UNAVAILABLE-RECURRENCE",
    )!;
    const evaluatedAt = new Date("2026-09-26T12:00:00.000Z");
    const evaluation = evaluateAlertWindow(rule, [], evaluatedAt);

    expect(prepareAlertDelivery(rule, evaluation, evaluatedAt)).toBeNull();
  });

  it("rejects both contradictory firing/count directions", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-STORAGE-ROOT-UNAVAILABLE-RECURRENCE",
    )!;
    const evaluatedAt = new Date("2026-09-26T12:00:00.000Z");
    const evaluation = evaluateAlertWindow(rule, [], evaluatedAt);

    expect(() =>
      prepareAlertDelivery(
        rule,
        { ...evaluation, firing: false, count: rule.threshold },
        evaluatedAt,
      ),
    ).toThrow("INVALID_ALERT_DELIVERY_INPUT");

    expect(() =>
      prepareAlertDelivery(
        rule,
        {
          ...evaluation,
          firing: true,
          count: rule.threshold - 1,
        },
        evaluatedAt,
      ),
    ).toThrow("INVALID_ALERT_DELIVERY_INPUT");
  });

  it("rejects arbitrary and non-canonical deduplication suffixes", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-STORAGE-ROOT-UNAVAILABLE-RECURRENCE",
    )!;
    const evaluatedAt = new Date("2026-09-26T12:00:00.000Z");
    const evaluation = evaluateAlertWindow(rule, [], evaluatedAt);
    const baseKey = `${rule.id}:${rule.component}`;

    for (const invalidEvaluation of [
      { ...evaluation, deduplicationKey: `${baseKey}:ARBITRARY` },
      {
        ...evaluation,
        partition: { surface: "PRIVATE_STORAGE", scope: "EXCHANGE_CREDENTIAL" } as const,
        deduplicationKey: `${baseKey}:PRIVATE_STORAGE:EXCHANGE_CREDENTIAL`,
      },
      { ...evaluation, deduplicationKey: `${baseKey}:EXTRA:DATA` },
    ]) {
      expect(() => prepareAlertDelivery(rule, invalidEvaluation, evaluatedAt)).toThrow(
        "INVALID_ALERT_DELIVERY_INPUT",
      );
    }
  });

  it("accepts an exact canonical partitioned deduplication key", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-RATE-LIMIT-429-RECURRENCE",
    )!;
    const evaluatedAt = new Date("2026-09-26T12:00:00.000Z");
    const evaluation = evaluateAlertWindow(
      rule,
      Array.from({ length: rule.threshold }, () => ({
        event: rule.event,
        occurredAt: evaluatedAt,
        surface: "BUYER_ACCESS_EXCHANGE" as const,
        scope: "EXCHANGE_CREDENTIAL" as const,
      })),
      evaluatedAt,
      { surface: "BUYER_ACCESS_EXCHANGE", scope: "EXCHANGE_CREDENTIAL" },
    );

    expect(prepareAlertDelivery(rule, evaluation, evaluatedAt)).toMatchObject({
      state: "FIRING",
      deduplicationKey:
        "P15-RATE-LIMIT-429-RECURRENCE:BUYER_ACCESS_DELIVERY:BUYER_ACCESS_EXCHANGE:EXCHANGE_CREDENTIAL",
      occurrenceCount: rule.threshold,
    });
  });

  it("uses a deterministic runtime predicate for .ts and .tsx while excluding tests", () => {
    expect(isRuntimeTypeScriptSource("authority.ts")).toBe(true);
    expect(isRuntimeTypeScriptSource("authority.tsx")).toBe(true);
    expect(isRuntimeTypeScriptSource("authority.test.ts")).toBe(false);
    expect(isRuntimeTypeScriptSource("authority.test.tsx")).toBe(false);
    expect(isRuntimeTypeScriptSource("authority.integration.ts")).toBe(false);
    expect(isRuntimeTypeScriptSource("authority.spec.tsx")).toBe(false);
    expect(isRuntimeTypeScriptSource("authority.d.ts")).toBe(false);
    expect(isRuntimeTypeScriptSource("authority.js")).toBe(false);
  });

  it("keeps commerce and payment authority independent from hosted monitoring", () => {
    const roots = [
      join(process.cwd(), "src", "modules", "commerce"),
      join(process.cwd(), "src", "modules", "payments"),
    ];
    const authoritySource = roots
      .flatMap(runtimeSources)
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    expect(authoritySource).not.toContain("hosted-observability");
    expect(authoritySource).not.toContain("createHostedMonitoringPlan");
    expect(authoritySource).not.toContain("prepareAlertDelivery");
  });
});
