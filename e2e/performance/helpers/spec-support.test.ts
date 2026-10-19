import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("P17 performance cohort fail-closed collection", () => {
  it("stops on every invalid warmup or measurement, not only the first smoke", () => {
    const source = readFileSync(resolve(import.meta.dirname, "spec-support.ts"), "utf8");

    expect(source).toContain(
      'const expectedState = planned.phase === "WARMUP" ? "WARMUP_VALID" : "VALID";',
    );
    expect(source).toContain("if (evidence.state !== expectedState)");
    expect(source).toContain('planned.attempt === 1 ? "SMOKE" : "ATTEMPT"');
    expect(source).not.toContain('if (planned.attempt === 1 && evidence.state !== "WARMUP_VALID")');
  });
});
