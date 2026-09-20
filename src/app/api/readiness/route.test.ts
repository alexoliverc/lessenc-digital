import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CORRELATION_RESPONSE_HEADER,
  INTERNAL_CORRELATION_REQUEST_HEADER,
} from "@/lib/observability/correlation";
import { evaluateReadiness } from "@/modules/health/readiness";

import { createReadinessHandler } from "./route";

const correlationId = "11111111-1111-4111-8111-111111111111";

describe("P15 readiness HTTP boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns only the sanitized READY contract", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const probe = vi.fn(async (resolvedCorrelationId: string) => {
      expect(resolvedCorrelationId).toBe(correlationId);
      return evaluateReadiness([
        { name: "APPLICATION_CONTRACT", ready: true },
        { name: "DATABASE_CONNECTIVITY", ready: true },
        { name: "PRIVATE_STORAGE", ready: true },
      ]);
    });
    const handler = createReadinessHandler(probe, () => true);

    const response = await handler(
      new Request("https://lessenc.example/api/readiness", {
        headers: { [INTERNAL_CORRELATION_REQUEST_HEADER]: correlationId },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready" });
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(probe).toHaveBeenCalledWith(correlationId);
  });

  it("ignores public client correlation input and generates server-side correlation", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const probe = vi.fn(async () =>
      evaluateReadiness([
        { name: "APPLICATION_CONTRACT", ready: true },
        { name: "DATABASE_CONNECTIVITY", ready: true },
        { name: "PRIVATE_STORAGE", ready: true },
      ]),
    );
    const handler = createReadinessHandler(probe, () => true);

    const response = await handler(
      new Request("https://lessenc.example/api/readiness", {
        headers: { [CORRELATION_RESPONSE_HEADER]: correlationId },
      }),
    );

    const resolvedCorrelationId = response.headers.get(CORRELATION_RESPONSE_HEADER);
    expect(resolvedCorrelationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(resolvedCorrelationId).not.toBe(correlationId);
    expect(probe).toHaveBeenCalledWith(resolvedCorrelationId);
  });

  it("returns generic NOT_READY without component or failure detail", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const handler = createReadinessHandler(
      async () =>
        evaluateReadiness([
          { name: "APPLICATION_CONTRACT", ready: true },
          {
            name: "DATABASE_CONNECTIVITY",
            ready: false,
            failureCode: "DATABASE_UNAVAILABLE",
          },
          { name: "PRIVATE_STORAGE", ready: true },
        ]),
      () => true,
    );

    const response = await handler(new Request("https://lessenc.example/api/readiness"));
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(503);
    expect(serialized).toBe('{"status":"not_ready"}');
    expect(serialized).not.toContain("DATABASE");
  });

  it("returns a generic response and never probes dependencies when unauthorized", async () => {
    const probe = vi.fn();
    const handler = createReadinessHandler(probe, () => false);

    const response = await handler(new Request("https://lessenc.example/api/readiness"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ status: "not_found" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get(CORRELATION_RESPONSE_HEADER)).toBeTruthy();
    expect(probe).not.toHaveBeenCalled();
  });

  it("fails closed without probing when authorization configuration throws", async () => {
    const probe = vi.fn();
    const handler = createReadinessHandler(probe, () => {
      throw new Error("missing configuration");
    });

    const response = await handler(new Request("https://lessenc.example/api/readiness"));

    expect(response.status).toBe(404);
    expect(probe).not.toHaveBeenCalled();
  });
});
