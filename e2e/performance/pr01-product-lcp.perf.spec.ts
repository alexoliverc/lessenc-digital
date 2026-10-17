import { test } from "@playwright/test";

import {
  cleanupSyntheticPerformanceCatalog,
  prepareSyntheticPerformanceCatalog,
} from "./fixtures/synthetic-business-state";
import { readLcpMetric, settleLcpCandidate } from "./helpers/browser-metrics";
import { assertPerformanceCollectionAuthorized } from "./helpers/orchestration";
import { cohortForProject, collectPerformanceCohort } from "./helpers/spec-support";

test.describe("P17-PR01 public product LCP", () => {
  let catalogPrepared = false;

  test.beforeAll(async () => {
    assertPerformanceCollectionAuthorized();
    await prepareSyntheticPerformanceCatalog();
    catalogPrepared = true;
  });

  test.afterAll(async () => {
    if (catalogPrepared) await cleanupSyntheticPerformanceCatalog();
  });

  test("collects the final browser LCP candidate", async ({ browser }, testInfo) => {
    const cohort = cohortForProject(testInfo, "PR01");
    const collection = await collectPerformanceCohort({
      browser,
      testInfo,
      cohort,
      measure: async ({ page }) => {
        const response = await page.goto("/cronograma-capilar-inteligente", {
          waitUntil: "domcontentloaded",
        });
        if (response?.status() !== 200) {
          return Object.freeze({ state: "INCONCLUSIVE", reason: "ENTRY_MISSING" });
        }
        await settleLcpCandidate(page);
        return readLcpMetric(page);
      },
    });

    await testInfo.attach(`p17-${cohort.viewport}-pr01-attempts`, {
      body: Buffer.from(`${JSON.stringify(collection, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
  });
});
