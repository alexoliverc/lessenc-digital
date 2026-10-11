import { test } from "@playwright/test";

import {
  cleanupCheckoutAttempt,
  cleanupSyntheticPerformanceCatalog,
  prepareSyntheticPerformanceCatalog,
} from "./fixtures/synthetic-business-state";
import {
  markInteractionTarget,
  readInpMetric,
  settleInteractionEntries,
  type BrowserMetricResult,
} from "./helpers/browser-metrics";
import { assertPerformanceCollectionAuthorized } from "./helpers/orchestration";
import { denyOptionalMeasurement } from "./helpers/browser-network-guard";
import { cohortForProject, collectPerformanceCohort } from "./helpers/spec-support";

test.describe("P17-PR02 checkout INP", () => {
  let catalogPrepared = false;

  test.beforeAll(async () => {
    assertPerformanceCollectionAuthorized();
    await prepareSyntheticPerformanceCatalog();
    catalogPrepared = true;
  });

  test.afterAll(async () => {
    if (catalogPrepared) await cleanupSyntheticPerformanceCatalog();
  });

  test("measures the representative order-creation interaction with Event Timing", async ({
    browser,
  }, testInfo) => {
    const cohort = cohortForProject(testInfo, "PR02");
    const collection = await collectPerformanceCohort({
      browser,
      testInfo,
      cohort,
      measure: async ({ page, attempt }) => {
        const email = `p17.performance.inp.${cohort.viewport}.${attempt}@example.invalid`;
        let stage:
          | "NAVIGATION_FAILED"
          | "FORM_FILL_FAILED"
          | "CONSENT_SETUP_FAILED"
          | "MARK_TARGET_FAILED"
          | "CLICK_FAILED"
          | "OUTCOME_NOT_OBSERVED"
          | "OBSERVER_READ_FAILED" = "NAVIGATION_FAILED";
        let metric: BrowserMetricResult;
        try {
          const response = await page.goto("/checkout", { waitUntil: "domcontentloaded" });
          if (response?.status() !== 200) {
            metric = Object.freeze({ state: "INCONCLUSIVE", reason: "ENTRY_MISSING" });
          } else {
            stage = "CONSENT_SETUP_FAILED";
            await denyOptionalMeasurement(page);
            stage = "FORM_FILL_FAILED";
            await page.getByLabel("Seu e-mail").fill(email);
            stage = "MARK_TARGET_FAILED";
            await markInteractionTarget(page, 'button[type="submit"]', "checkout-create-order");
            stage = "CLICK_FAILED";
            await page.getByRole("button", { name: "Criar pedido" }).click();
            stage = "OUTCOME_NOT_OBSERVED";
            await page.getByText("Pedido criado", { exact: true }).waitFor({ state: "visible" });
            stage = "OBSERVER_READ_FAILED";
            await settleInteractionEntries(page);
            metric = await readInpMetric(page, "checkout-create-order");
          }
        } catch {
          metric = Object.freeze({ state: "INCONCLUSIVE", reason: stage });
        }
        try {
          await cleanupCheckoutAttempt(email);
        } catch {
          return Object.freeze({ state: "INCONCLUSIVE", reason: "FIXTURE_CLEANUP_FAILED" });
        }
        return metric;
      },
    });

    await testInfo.attach(`p17-${cohort.viewport}-pr02-attempts`, {
      body: Buffer.from(`${JSON.stringify(collection, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
  });
});
