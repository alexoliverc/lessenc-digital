import { describe, expect, it } from "vitest";

import {
  executePerformanceControllerPlan,
  selectPerformancePlaywrightArgs,
} from "../../../scripts/p17-performance-controller.mjs";

const pixArgs = [
  "test",
  "--config=playwright.performance.config.ts",
  "pr03-payment-initiation.perf.spec.ts",
  "--project=chromium-mobile",
  "--grep=measures PIX interaction to browser requestStart",
];

describe("P17 selective PR03 execution", () => {
  it("preserves the complete acceptance command", () => {
    expect(selectPerformancePlaywrightArgs()).toEqual([
      "test",
      "--config=playwright.performance.config.ts",
    ]);
  });

  it("selects only the approved PR03 PIX mobile test", () => {
    expect(selectPerformancePlaywrightArgs("PR03_PIX_MOBILE")).toEqual(pixArgs);
  });

  it("rejects unknown selectors", () => {
    expect(() => selectPerformancePlaywrightArgs("PR03_CARD")).toThrow(
      "P17_PERFORMANCE_SELECTION_NOT_AUTHORIZED",
    );
  });

  it("rejects unknown selection before starting database operations", async () => {
    let databaseStarted = false;

    await expect(
      executePerformanceControllerPlan(
        {
          waitForDatabase: async () => {
            databaseStarted = true;
          },
          runCommand: async () => undefined,
          startCalibration: async () => undefined,
          verifyCalibration: async () => undefined,
          startApplication: () => ({}),
          waitForApplication: async () => undefined,
          stopApplication: async () => undefined,
          stopCalibration: async () => undefined,
        },
        "UNAUTHORIZED",
      ),
    ).rejects.toThrow("P17_PERFORMANCE_SELECTION_NOT_AUTHORIZED");

    expect(databaseStarted).toBe(false);
  });

  it("passes only the selected test arguments to Playwright", async () => {
    const commands: { executable: string; args: string[] }[] = [];

    await executePerformanceControllerPlan(
      {
        waitForDatabase: async () => undefined,
        runCommand: async (executable: string, args: string[]) => {
          commands.push({ executable, args });
        },
        startCalibration: async () => undefined,
        verifyCalibration: async () => undefined,
        startApplication: () => ({}),
        waitForApplication: async () => undefined,
        stopApplication: async () => undefined,
        stopCalibration: async () => undefined,
      },
      "PR03_PIX_MOBILE",
    );

    const playwright = commands.filter(({ executable }) => executable.endsWith("/playwright"));

    expect(playwright).toHaveLength(1);
    expect(playwright[0]?.args).toEqual(pixArgs);
  });
});
