import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import process from "node:process";
import { chromium } from "playwright";

// Diagnostic measurements only: no owner-approved budget or calibrated profile is implied.
assert.equal(process.env.APP_ENV, "local");
assert.equal(process.env.P17_TARGET, "local");
assert.equal(process.getuid(), 17017);
const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  for (const [name, width, height] of [
    ["mobile", 390, 844],
    ["tablet", 768, 1024],
    ["desktop", 1440, 900],
  ]) {
    for (const route of ["/", "/cronograma-capilar-inteligente"]) {
      const samples = [];
      for (let attempt = -2; attempt < 40; attempt++) {
        const context = await browser.newContext({
          viewport: { width, height },
          serviceWorkers: "block",
        });
        try {
          const page = await context.newPage();
          const response = await page.goto(`http://127.0.0.1:3100${route}`, { waitUntil: "load" });
          assert.equal(response.status(), 200);
          const timing = await page.evaluate(() => {
            // eslint-disable-next-line no-undef
            const n = performance.getEntriesByType("navigation")[0];
            return {
              ttfbMs: n.responseStart - n.requestStart,
              domContentLoadedMs: n.domContentLoadedEventEnd - n.startTime,
            };
          });
          assert.ok(Object.values(timing).every((v) => Number.isFinite(v) && v >= 0));
          if (attempt >= 0) samples.push(timing);
        } finally {
          await context.close();
        }
      }
      const percentile = (key, rank) =>
        [...samples].map((s) => s[key]).sort((a, b) => a - b)[Math.ceil(rank * 40) - 1];
      rows.push({
        viewport: name,
        route,
        warmups: 2,
        validSamples: samples.length,
        samples,
        ttfbMs: {
          p50: percentile("ttfbMs", 0.5),
          p75: percentile("ttfbMs", 0.75),
          p95: percentile("ttfbMs", 0.95),
        },
        domContentLoadedMs: {
          p50: percentile("domContentLoadedMs", 0.5),
          p75: percentile("domContentLoadedMs", 0.75),
          p95: percentile("domContentLoadedMs", 0.95),
        },
      });
    }
  }
  const report = {
    schemaVersion: 1,
    indicator: "PR01",
    result: "DIAGNOSTIC_ONLY",
    acceptance: "DIAGNOSTIC_ONLY_APPROVED_BUDGET_NOT_EVALUATED",
    network: "LOOPBACK_UNTHROTTLED_UNCALIBRATED",
    browser: browser.version(),
    rows,
  };
  writeFileSync(
    "/workspace/output/navigation-diagnostics.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  process.stdout.write(
    JSON.stringify({
      result: report.result,
      acceptance: report.acceptance,
      groups: rows.length,
      samples: rows.reduce((n, r) => n + r.validSamples, 0),
    }) + "\n",
  );
} finally {
  await browser.close();
}
