import { describe, expect, it, vi } from "vitest";

import { executePerformanceControllerPlan } from "../../../scripts/p17-performance-controller.mjs";

describe("P17 local performance controller behavior", () => {
  it("runs migrations, calibration, application and Playwright in the fixed order", async () => {
    const events: string[] = [];
    const application = Object.freeze({ kind: "synthetic-application" });
    await executePerformanceControllerPlan({
      waitForDatabase: async () => events.push("database-ready"),
      runCommand: async (executable: string) => events.push(`command:${executable}`),
      startCalibration: async () => events.push("calibration-started"),
      verifyCalibration: async () => events.push("calibration-verified"),
      startApplication: () => {
        events.push("application-started");
        return application;
      },
      waitForApplication: async () => events.push("application-ready"),
      stopApplication: async (value: unknown) => {
        expect(value).toBe(application);
        events.push("application-stopped");
      },
      stopCalibration: async () => events.push("calibration-stopped"),
    });

    expect(events).toEqual([
      "database-ready",
      "command:./node_modules/.bin/prisma",
      "calibration-started",
      "calibration-verified",
      "application-started",
      "application-ready",
      "command:./node_modules/.bin/playwright",
      "application-stopped",
      "calibration-stopped",
    ]);
  });

  it("always tears down started local processes after a Playwright failure", async () => {
    const stopApplication = vi.fn(async () => undefined);
    const stopCalibration = vi.fn(async () => undefined);
    const application = Object.freeze({ kind: "synthetic-application" });

    await expect(
      executePerformanceControllerPlan({
        waitForDatabase: async () => undefined,
        runCommand: async (executable: string) => {
          if (executable.endsWith("playwright")) throw new Error("SYNTHETIC_PLAYWRIGHT_FAILURE");
        },
        startCalibration: async () => undefined,
        verifyCalibration: async () => undefined,
        startApplication: () => application,
        waitForApplication: async () => undefined,
        stopApplication,
        stopCalibration,
      }),
    ).rejects.toThrow("SYNTHETIC_PLAYWRIGHT_FAILURE");
    expect(stopApplication).toHaveBeenCalledWith(application);
    expect(stopCalibration).toHaveBeenCalledOnce();
  });

  it("does not claim calibration cleanup before calibration starts", async () => {
    const stopCalibration = vi.fn(async () => undefined);
    await expect(
      executePerformanceControllerPlan({
        waitForDatabase: async () => {
          throw new Error("SYNTHETIC_DATABASE_FAILURE");
        },
        runCommand: async () => undefined,
        startCalibration: async () => undefined,
        verifyCalibration: async () => undefined,
        startApplication: () => Object.freeze({}),
        waitForApplication: async () => undefined,
        stopApplication: async () => undefined,
        stopCalibration,
      }),
    ).rejects.toThrow("SYNTHETIC_DATABASE_FAILURE");
    expect(stopCalibration).not.toHaveBeenCalled();
  });
});
