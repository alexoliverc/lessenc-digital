import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  computeSourceProvenance,
  sourceProvenanceFiles,
} from "../../../scripts/p17-source-provenance.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("P17 source and OCI build-input provenance", () => {
  it("covers application source, Docker recipes, lockfile, bootstrap and supply chain", () => {
    const files = sourceProvenanceFiles(repositoryRoot);
    for (const required of [
      ".dockerignore",
      "package-lock.json",
      "e2e/performance/capsule/Dockerfile",
      "e2e/performance/capsule/compose.yaml",
      "e2e/performance/capsule/build-app.sh",
      "e2e/performance/capsule/bootstrap-toolchain.sh",
      "e2e/performance/capsule/supply-chain.json",
      "e2e/performance/capsule/offline/artifacts/npm-11.19.1.tgz",
      "e2e/performance/capsule/offline/artifacts/libssl3_3.0.22-1~deb12u1_amd64.deb",
      "e2e/performance/capsule/offline/artifacts/schema-engine.gz",
      "e2e/performance/capsule/offline/manifests/npm-11.19.1-node-24.21.0-linux-amd64-glibc-E93A35F25C59.manifest.json",
      "e2e/performance/capsule/offline/manifests/npm-11.19.1-node-24.21.0-linux-amd64-glibc-E93A35F25C59.files.sha512",
    ]) {
      expect(files).toContain(required);
    }
  });

  it("produces deterministic component digests and keeps the commit outside byte authority", () => {
    const first = computeSourceProvenance(repositoryRoot);
    const second = computeSourceProvenance(repositoryRoot);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: 2,
      algorithm: "SHA-256",
      components: {
        applicationSource: { digest: expect.stringMatching(/^[0-9a-f]{64}$/u) },
        containerRecipes: { digest: expect.stringMatching(/^[0-9a-f]{64}$/u) },
        dependencyLock: { digest: expect.stringMatching(/^[0-9a-f]{64}$/u) },
        supplyChain: { digest: expect.stringMatching(/^[0-9a-f]{64}$/u) },
      },
    });
    expect(JSON.stringify(first)).not.toContain("e484f35352ec9bcedde645239342e15d3327cc25");
  });

  it("binds OCI labels to source bytes while leaving the declared commit as metadata", () => {
    const dockerfile = readFileSync(
      resolve(repositoryRoot, "e2e/performance/capsule/Dockerfile"),
      "utf8",
    );
    expect(dockerfile).toContain("com.lessenc.p17.source-provenance.sha256");
    expect(dockerfile).toContain("org.opencontainers.image.revision");
    expect(dockerfile).toContain("METADATA_ONLY_NOT_SOURCE_BYTE_PROOF");
  });
});
