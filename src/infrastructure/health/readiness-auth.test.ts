import { describe, expect, it } from "vitest";

import { isReadinessRequestAuthorized } from "./readiness-auth";

const TOKEN = "p16-readiness-machine-token-32-bytes-minimum";

describe("P16 readiness machine authentication", () => {
  it("accepts only the exact bearer token", () => {
    expect(
      isReadinessRequestAuthorized(
        new Request("https://lessenc.example/api/readiness", {
          headers: { authorization: `Bearer ${TOKEN}` },
        }),
        TOKEN,
      ),
    ).toBe(true);
  });

  it.each([
    undefined,
    "",
    `bearer ${TOKEN}`,
    `Basic ${TOKEN}`,
    "Bearer wrong-token-with-more-than-32-characters",
    `Bearer ${TOKEN} trailing`,
  ])("fails closed for malformed or incorrect authorization: %s", (authorization) => {
    const request =
      authorization === undefined
        ? new Request("https://lessenc.example/api/readiness")
        : new Request("https://lessenc.example/api/readiness", {
            headers: { authorization },
          });
    expect(isReadinessRequestAuthorized(request, TOKEN)).toBe(false);
  });
});
