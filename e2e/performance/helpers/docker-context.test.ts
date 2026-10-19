import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { assertDockerContextInventory } from "../../../scripts/p17-docker-context-audit.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

describe("P17 Docker build-context policy", () => {
  it("rejects credential, secret and private workspace fixtures after all negations", () => {
    for (const forbidden of [
      "src/.env",
      "src/.env.spec.ts",
      "scripts/private.pem",
      ".npmrc",
      "e2e/fixture.key",
      "docs/private.md",
      "memory/private.md",
      "output/private.json",
    ]) {
      expect(() => assertDockerContextInventory([forbidden], [])).toThrow(
        "P17_DOCKER_CONTEXT_FORBIDDEN_PATH",
      );
    }
  });

  it("accepts only an inventory containing every required build input", () => {
    expect(
      assertDockerContextInventory(
        ["src/allowed.ts", "scripts/allowed.mjs"],
        ["src/allowed.ts", "scripts/allowed.mjs"],
      ),
    ).toMatchObject({ requiredCount: 2 });
    expect(() =>
      assertDockerContextInventory(["src/allowed.ts"], ["src/allowed.ts", "package-lock.json"]),
    ).toThrow("P17_DOCKER_CONTEXT_REQUIRED_PATH_MISSING");
  });

  it("keeps the Docker-consumed snapshot byte-identical and the deny block final", () => {
    const dockerignore = readFileSync(resolve(repositoryRoot, ".dockerignore"), "utf8");
    const snapshot = readFileSync(
      resolve(repositoryRoot, "e2e/performance/capsule/dockerignore.snapshot"),
      "utf8",
    );
    expect(snapshot).toBe(dockerignore);
    const finalBlock = dockerignore.indexOf("# Final defense in depth");
    expect(finalBlock).toBeGreaterThan(0);
    expect(dockerignore.slice(finalBlock)).not.toMatch(/^!/mu);
  });
});
