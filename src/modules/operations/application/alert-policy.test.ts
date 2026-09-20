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
  });

  it("keeps production SLO targets open until staging provides a baseline", () => {
    expect(P15_SLI_CATALOG.length).toBeGreaterThanOrEqual(4);
    expect(P15_SLI_CATALOG.every((sli) => sli.target === "OPEN_STAGING_BASELINE")).toBe(true);
  });
});
