import { afterEach, describe, expect, it, vi } from "vitest";

import { INTERNAL_CORRELATION_REQUEST_HEADER } from "@/lib/observability/correlation";

import { GET } from "./route";

describe("public liveness HTTP boundary", () => {
  afterEach(() => vi.restoreAllMocks());

  it("remains liveness-only while carrying the canonical correlation response", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const correlationId = "11111111-1111-4111-8111-111111111111";

    const response = GET(
      new Request("https://lessenc.example/api/health", {
        headers: { [INTERNAL_CORRELATION_REQUEST_HEADER]: correlationId },
      }),
    );

    expect(response.status).toBe(200);
    const body = JSON.stringify(await response.json());
    expect(body).toBe('{"status":"ok"}');
    expect(response.headers.get("x-correlation-id")).toBe(correlationId);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).not.toContain("DATABASE");
  });
});
