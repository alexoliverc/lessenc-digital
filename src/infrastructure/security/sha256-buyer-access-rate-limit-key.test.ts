import { describe, expect, it } from "vitest";

import { Sha256BuyerAccessRateLimitKey } from "./sha256-buyer-access-rate-limit-key";

describe("Sha256BuyerAccessRateLimitKey", () => {
  it("returns a deterministic lowercase SHA-256 digest", () => {
    const hasher =
      new Sha256BuyerAccessRateLimitKey();

    const first = hasher.hash(
      "EXCHANGE_CREDENTIAL",
      "lba_example",
    );

    const second = hasher.hash(
      "EXCHANGE_CREDENTIAL",
      "lba_example",
    );

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("domain-separates identical material by scope", () => {
    const hasher =
      new Sha256BuyerAccessRateLimitKey();

    expect(
      hasher.hash(
        "EXCHANGE_CREDENTIAL",
        "same-material",
      ),
    ).not.toBe(
      hasher.hash(
        "DOWNLOAD_CREDENTIAL",
        "same-material",
      ),
    );
  });

  it("separates distinct material inside one scope", () => {
    const hasher =
      new Sha256BuyerAccessRateLimitKey();

    expect(
      hasher.hash(
        "LIBRARY_CREDENTIAL",
        "credential-a",
      ),
    ).not.toBe(
      hasher.hash(
        "LIBRARY_CREDENTIAL",
        "credential-b",
      ),
    );
  });

  it("rejects empty material", () => {
    const hasher =
      new Sha256BuyerAccessRateLimitKey();

    expect(() =>
      hasher.hash(
        "EXCHANGE_GLOBAL",
        "",
      ),
    ).toThrow("INVALID_RATE_LIMIT_MATERIAL");
  });

  it("rejects oversized material", () => {
    const hasher =
      new Sha256BuyerAccessRateLimitKey();

    expect(() =>
      hasher.hash(
        "EXCHANGE_CREDENTIAL",
        "x".repeat(4097),
      ),
    ).toThrow("INVALID_RATE_LIMIT_MATERIAL");
  });

  it("rejects an unsupported runtime scope", () => {
    const hasher =
      new Sha256BuyerAccessRateLimitKey();

    expect(() =>
      hasher.hash(
        "INVALID" as never,
        "material",
      ),
    ).toThrow("INVALID_RATE_LIMIT_SCOPE");
  });
});
