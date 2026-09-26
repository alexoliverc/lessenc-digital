import { describe, expect, it } from "vitest";

import { evaluateAlertWindow, P15_ALERT_RULES, P15_SLI_CATALOG } from "./alert-policy";

describe("P15 alert, ownership and SLI policy", () => {
  it("preserves the immediate P11 delivery-audit alert", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-DELIVERY-AUDIT-UNAVAILABLE",
    )!;
    const now = new Date("2026-09-19T12:00:00.000Z");

    const result = evaluateAlertWindow(
      rule,
      [
        {
          event: "delivery_audit_unavailable",
          failureCode: "DELIVERY_AUDIT_UNAVAILABLE",
          occurredAt: now,
        },
      ],
      now,
    );

    expect(result).toEqual({
      firing: true,
      count: 1,
      deduplicationKey: "P15-DELIVERY-AUDIT-UNAVAILABLE:BUYER_ACCESS_DELIVERY",
      severity: "CRITICAL",
      owner: "OWNER_ON_CALL",
    });
  });

  it("preserves the five-minute recurrence threshold without process-local state", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-STORAGE-ROOT-UNAVAILABLE-RECURRENCE",
    )!;
    const now = new Date("2026-09-19T12:05:00.000Z");
    const signal = (secondsAgo: number) => ({
      event: "private_storage_failure",
      failureCode: "STORAGE_ROOT_UNAVAILABLE",
      occurredAt: new Date(now.getTime() - secondsAgo * 1000),
    });

    expect(evaluateAlertWindow(rule, [signal(299), signal(200)], now).firing).toBe(false);
    expect(evaluateAlertWindow(rule, [signal(299), signal(200), signal(1)], now).firing).toBe(true);
    expect(evaluateAlertWindow(rule, [signal(301), signal(200), signal(1)], now).count).toBe(2);
  });

  it("evaluates the rate-limit recurrence per bounded surface and scope", () => {
    const rule = P15_ALERT_RULES.find(
      (candidate) => candidate.id === "P15-RATE-LIMIT-429-RECURRENCE",
    )!;
    const now = new Date("2026-09-19T12:05:00.000Z");
    const signals = [
      ...Array.from({ length: 20 }, () => ({
        event: "buyer_access_rate_limited",
        occurredAt: now,
        surface: "BUYER_ACCESS_EXCHANGE" as const,
        scope: "EXCHANGE_CREDENTIAL" as const,
      })),
      ...Array.from({ length: 50 }, () => ({
        event: "buyer_access_rate_limited",
        occurredAt: now,
        surface: "PROTECTED_DOWNLOAD" as const,
        scope: "DOWNLOAD_CREDENTIAL" as const,
      })),
    ];

    const exchange = evaluateAlertWindow(rule, signals, now, {
      surface: "BUYER_ACCESS_EXCHANGE",
      scope: "EXCHANGE_CREDENTIAL",
    });

    expect(exchange.count).toBe(20);
    expect(exchange.firing).toBe(true);
    expect(exchange.deduplicationKey).toBe(
      "P15-RATE-LIMIT-429-RECURRENCE:BUYER_ACCESS_DELIVERY:BUYER_ACCESS_EXCHANGE:EXCHANGE_CREDENTIAL",
    );
    expect(exchange.partition).toEqual({
      surface: "BUYER_ACCESS_EXCHANGE",
      scope: "EXCHANGE_CREDENTIAL",
    });
  });

  it("keeps production SLO targets open until staging provides a baseline", () => {
    expect(P15_SLI_CATALOG.length).toBeGreaterThanOrEqual(4);
    expect(P15_SLI_CATALOG.every((sli) => sli.target === "OPEN_STAGING_BASELINE")).toBe(true);
  });

  it("fails closed for invalid alert signal fields", () => {
    const rule = P15_ALERT_RULES[0]!;
    const now = new Date("2026-09-26T12:00:00.000Z");

    for (const signal of [
      { event: "unsafe event", occurredAt: now },
      { event: rule.event, failureCode: "secret=value", occurredAt: now },
      { event: rule.event, occurredAt: new Date("invalid") },
      { event: rule.event, occurredAt: now, scope: "EXCHANGE_GLOBAL" },
      {
        event: rule.event,
        occurredAt: now,
        surface: "PRIVATE_STORAGE",
        scope: "EXCHANGE_CREDENTIAL",
      },
    ]) {
      expect(() => evaluateAlertWindow(rule, [signal as never], now)).toThrow(
        "INVALID_ALERT_SIGNAL",
      );
    }
  });

  it("fails closed for non-canonical alert partition combinations", () => {
    const rule = P15_ALERT_RULES[0]!;
    const now = new Date("2026-09-26T12:00:00.000Z");

    expect(() =>
      evaluateAlertWindow(rule, [], now, {
        surface: "PRIVATE_STORAGE",
        scope: "EXCHANGE_CREDENTIAL",
      }),
    ).toThrow("INVALID_ALERT_PARTITION");
  });

  it("fails closed for invalid rule routing fields", () => {
    const now = new Date("2026-09-26T12:00:00.000Z");
    const rule = P15_ALERT_RULES[0]!;

    for (const invalid of [
      { ...rule, severity: "URGENT" },
      { ...rule, owner: "EXTERNAL_PROVIDER" },
      { ...rule, component: "DATABASE" },
    ]) {
      expect(() => evaluateAlertWindow(invalid as never, [], now)).toThrow(
        "INVALID_ALERT_RULE_ROUTING",
      );
    }
  });
});
