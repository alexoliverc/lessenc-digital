import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

function runtimeSourceFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "generated") files.push(...runtimeSourceFiles(path));
      continue;
    }
    if (
      /\.(ts|tsx)$/u.test(entry.name) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".integration.ts")
    ) {
      files.push(path);
    }
  }

  return files;
}

describe("P15 observability privacy and canonical logging gate", () => {
  it("keeps direct runtime console output isolated to the canonical logger", () => {
    const sourceRoot = join(process.cwd(), "src");
    const violations = runtimeSourceFiles(sourceRoot)
      .filter((path) => !path.endsWith(join("lib", "observability", "logger.ts")))
      .filter((path) => /console\.(?:log|info|warn|error)\s*\(/u.test(readFileSync(path, "utf8")))
      .map((path) => relative(process.cwd(), path));

    expect(violations).toEqual([]);
  });

  it("keeps public liveness isolated from deep dependency checks", () => {
    const source = readFileSync(
      join(process.cwd(), "src", "app", "api", "health", "route.ts"),
      "utf8",
    );

    expect(source).not.toContain("getDatabaseClient");
    expect(source).not.toContain("PRIVATE_FILE_STORAGE_PATH");
    expect(source).not.toContain("runReadinessProbe");
    expect(source).not.toContain("evaluateOperationalHealth");
  });

  it("uses the canonical generator only for checkout and administration correlation IDs", () => {
    const checkout = readFileSync(
      join(process.cwd(), "src", "app", "checkout", "actions.ts"),
      "utf8",
    );
    expect(checkout).toContain("const correlationId = createCorrelationId()");
    expect(checkout).toContain("itemId: randomUUID()");
    expect(checkout).toContain("customerId: randomUUID()");

    for (const file of [
      "admin-audit.ts",
      "change-admin-role.ts",
      "change-product-status.ts",
      "reset-admin-mfa.ts",
    ]) {
      const source = readFileSync(
        join(process.cwd(), "src", "modules", "administration", "infrastructure", file),
        "utf8",
      );
      expect(source).toContain("createCorrelationId");
      expect(source).not.toContain("randomUUID");
    }
  });
});
