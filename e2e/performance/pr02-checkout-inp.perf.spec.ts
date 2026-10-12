import { test } from "@playwright/test";

import {
  cleanupCheckoutAttempt,
  cleanupSyntheticPerformanceCatalog,
  createSyntheticCheckoutEmail,
  prepareSyntheticPerformanceCatalog,
} from "./fixtures/synthetic-business-state";
import {
  alignInteractionAfterFrame,
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
        const email = createSyntheticCheckoutEmail(cohort.viewport, attempt);
        let stage:
          | "NAVIGATION_FAILED"
          | "FORM_FILL_FAILED"
          | "CONSENT_SETUP_FAILED"
          | "HYDRATION_WAIT_FAILED"
          | "INTERACTION_ALIGNMENT_FAILED"
          | "MARK_TARGET_FAILED"
          | "CLICK_FAILED"
          | "SETTLE_INTERACTION_FAILED"
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
            stage = "HYDRATION_WAIT_FAILED";
            // A click before hydration falls back to the native Server Action form submission and
            // replaces the document, which invalidates the page-side Event Timing observer. The
            // representative interaction must start only after the client action is attached.
            await page.waitForLoadState("networkidle");
            stage = "FORM_FILL_FAILED";
            await page.getByLabel("Seu e-mail").fill(email);
            stage = "MARK_TARGET_FAILED";
            const submitButton = page.getByRole("button", { name: "Criar pedido" });
            await markInteractionTarget(page, 'button[type="submit"]', "checkout-create-order");
            await submitButton.scrollIntoViewIfNeeded();
            const bounds = await submitButton.boundingBox();
            if (bounds === null) throw new Error("P17_PR02_SUBMIT_BUTTON_NOT_VISIBLE");
            stage = "INTERACTION_ALIGNMENT_FAILED";
            await alignInteractionAfterFrame(page);
            stage = "CLICK_FAILED";
            // Mouse input is trusted but, unlike Locator.click(), returns after dispatching the
            // pointer/click sequence instead of waiting for the Server Action response. This lets
            // us finalize Event Timing before React replaces the submitted form subtree.
            await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
            stage = "SETTLE_INTERACTION_FAILED";
            // Capture the interaction before the Server Action response can replace React's form
            // subtree (or its document state). The functional outcome is still mandatory below.
            await settleInteractionEntries(page);
            stage = "OBSERVER_READ_FAILED";
            metric = await readInpMetric(page, "checkout-create-order");
            stage = "OUTCOME_NOT_OBSERVED";
            await page.getByText("Pedido criado", { exact: true }).waitFor({ state: "visible" });
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
