import { test } from "@playwright/test";

import {
  cleanupSyntheticOrder,
  cleanupSyntheticPerformanceCatalog,
  createProtectedDeliveryFixture,
  hasExactSuccessfulProtectedDeliveryAudit,
  prepareSyntheticPerformanceCatalog,
} from "./fixtures/synthetic-business-state";
import { readDeliveryTtfbMetric } from "./helpers/browser-metrics";
import { PERFORMANCE_BASE_URL } from "./helpers/isolation";
import { assertPerformanceCollectionAuthorized } from "./helpers/orchestration";
import { cohortForProject, collectPerformanceCohort } from "./helpers/spec-support";

test.describe("P17-PR04 protected delivery HTTP TTFB", () => {
  let catalogPrepared = false;

  test.beforeAll(async () => {
    assertPerformanceCollectionAuthorized();
    await prepareSyntheticPerformanceCatalog();
    catalogPrepared = true;
  });

  test.afterAll(async () => {
    if (catalogPrepared) await cleanupSyntheticPerformanceCatalog();
  });

  test("measures responseStart minus requestStart only for an authorized delivery", async ({
    browser,
  }, testInfo) => {
    const cohort = cohortForProject(testInfo, "PR04");
    const collection = await collectPerformanceCohort({
      browser,
      testInfo,
      cohort,
      measure: async ({ page, attempt }) => {
        const fixture = await createProtectedDeliveryFixture(attempt);

        try {
          await page.context().addCookies([
            {
              name: "lessenc_buyer",
              value: fixture.buyerCookie,
              url: PERFORMANCE_BASE_URL,
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          const navigation = await page.goto("/", { waitUntil: "domcontentloaded" });
          if (navigation?.status() !== 200) {
            return Object.freeze({ state: "INCONCLUSIVE", reason: "ENTRY_MISSING" });
          }

          const response = await page.evaluate(async (resourcePath) => {
            const result = await fetch(resourcePath, {
              method: "GET",
              credentials: "same-origin",
              cache: "no-store",
              redirect: "error",
            });
            const body = await result.arrayBuffer();
            return {
              status: result.status,
              redirected: result.redirected,
              contentType: result.headers.get("content-type"),
              disposition: result.headers.get("content-disposition"),
              bytes: body.byteLength,
            };
          }, fixture.resourcePath);

          if (
            response.redirected ||
            // This scenario sends no Range header; an unsolicited partial response is invalid.
            response.status !== 200 ||
            response.bytes <= 0 ||
            response.contentType !== "application/zip" ||
            !response.disposition?.startsWith("attachment;")
          ) {
            return Object.freeze({ state: "INCONCLUSIVE", reason: "HTTP_STATUS_INVALID" });
          }

          const timing = await readDeliveryTtfbMetric(page, fixture.resourcePath, response.status);

          if (timing.state !== "VALID") {
            return timing;
          }

          const auditProven = await hasExactSuccessfulProtectedDeliveryAudit(fixture);

          if (!auditProven) {
            return Object.freeze({
              state: "INCONCLUSIVE",
              reason: "DELIVERY_AUDIT_NOT_PROVEN",
            });
          }

          return timing;
        } finally {
          await cleanupSyntheticOrder(fixture);
        }
      },
    });

    await testInfo.attach(`p17-${cohort.viewport}-pr04-attempts`, {
      body: Buffer.from(`${JSON.stringify(collection, null, 2)}\n`, "utf8"),
      contentType: "application/json",
    });
  });
});
