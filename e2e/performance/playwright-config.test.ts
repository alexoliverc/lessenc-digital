import { describe, expect, it } from "vitest";

import config from "../../playwright.performance.config";

describe("P17 dedicated Playwright performance configuration", () => {
  it("is local-only, serial, retry-free and restricted to future performance specs", () => {
    expect(config.testDir?.replaceAll("\\", "/")).toMatch(/\/e2e\/performance$/u);
    expect(config.testMatch).toBe("**/*.perf.spec.ts");
    expect(config.retries).toBe(0);
    expect(config.workers).toBe(1);
    expect(config.fullyParallel).toBe(false);
    expect(config.use?.baseURL).toBe("http://127.0.0.1:3100");
    expect(config.use?.serviceWorkers).toBe("block");
    expect(config.webServer).toBeUndefined();
  });

  it("contains only the three approved Chromium viewports", () => {
    expect(
      config.projects?.map((project) => ({
        name: project.name,
        browserName: project.use?.browserName,
        viewport: project.use?.viewport,
      })),
    ).toEqual([
      {
        name: "chromium-mobile",
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
      {
        name: "chromium-tablet",
        browserName: "chromium",
        viewport: { width: 768, height: 1024 },
      },
      {
        name: "chromium-desktop",
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    ]);
  });
});
