import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { OpaqueBuyerAccessCredentialService } from "./opaque-buyer-access-credential";

function deterministicRandom(byte: number) {
  return (size: number): Buffer => Buffer.alloc(size, byte);
}

describe("OpaqueBuyerAccessCredentialService", () => {
  it("issues a 256-bit opaque buyer credential with the L'Essenc prefix", () => {
    const service = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x11));

    const issued = service.issue();

    expect(issued.rawCredential).toMatch(/^lba_[A-Za-z0-9_-]{43}$/u);
    expect(issued.rawCredential).toHaveLength(47);
  });

  it("persists only a 64-character SHA-256 representation", () => {
    const service = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x22));

    const issued = service.issue();

    expect(issued.secretHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(issued.secretHash).toBe(
      createHash("sha256").update(issued.rawCredential, "utf8").digest("hex"),
    );
    expect(issued.secretHash).not.toContain(issued.rawCredential);
  });

  it("does not encode buyer, order or entitlement data in the credential", () => {
    const service = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x33));

    const issued = service.issue();

    expect(issued.rawCredential.split(".")).toHaveLength(1);
    expect(issued.rawCredential).not.toContain("{");
    expect(issued.rawCredential).not.toContain("}");
    expect(issued.rawCredential).not.toContain("@");
  });

  it("hashes a correctly formatted credential deterministically", () => {
    const service = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x44));

    const issued = service.issue();

    expect(service.hash(issued.rawCredential)).toEqual({
      ok: true,
      secretHash: issued.secretHash,
    });

    expect(service.hash(issued.rawCredential)).toEqual(service.hash(issued.rawCredential));
  });

  it.each([
    null,
    undefined,
    "",
    "lba_",
    "anything",
    "lba_***",
    `lba_${"a".repeat(42)}`,
    `lba_${"a".repeat(44)}`,
    `LBA_${"a".repeat(43)}`,
    { credential: "secret" },
  ])("rejects malformed credentials without reflecting their value: %j", (input) => {
    const service = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x55));

    const result = service.hash(input);

    expect(result).toEqual({
      ok: false,
      reason: "MALFORMED_CREDENTIAL",
    });

    expect(JSON.stringify(result)).not.toContain(
      typeof input === "string" && input ? input : "secret-value-never-present",
    );
  });

  it("rejects an invalid random source instead of weakening entropy", () => {
    const service = new OpaqueBuyerAccessCredentialService(() => Buffer.alloc(16));

    expect(() => service.issue()).toThrow("BUYER_ACCESS_CREDENTIAL_RANDOM_SOURCE_INVALID");
  });

  it("produces different credentials from different random material", () => {
    const first = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x66)).issue();

    const second = new OpaqueBuyerAccessCredentialService(deterministicRandom(0x77)).issue();

    expect(first.rawCredential).not.toBe(second.rawCredential);
    expect(first.secretHash).not.toBe(second.secretHash);
  });
});
