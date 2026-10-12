import { test } from "@playwright/test";

import {
  cleanupSyntheticOrder,
  cleanupSyntheticPerformanceCatalog,
  createPendingPaymentFixture,
  prepareSyntheticPerformanceCatalog,
} from "./fixtures/synthetic-business-state";
import {
  markInteractionTarget,
  readPaymentPostInitiationDiagnostic,
  readPaymentPostInitiationMetric,
  settlePaymentResourceEntries,
  type BrowserMetricResult,
} from "./helpers/browser-metrics";
import {
  fulfillSyntheticPaymentStart,
  denyOptionalMeasurement,
  installSyntheticCardBrick,
  observeSyntheticPaymentStartAction,
  signalSyntheticSdkReady,
} from "./helpers/browser-network-guard";
import { PERFORMANCE_BASE_URL } from "./helpers/isolation";
import { assertPerformanceCollectionAuthorized } from "./helpers/orchestration";
import { cohortForProject, collectPerformanceCohort } from "./helpers/spec-support";

type InconclusiveReason = Extract<BrowserMetricResult, { state: "INCONCLUSIVE" }>["reason"];

function consentSetupFailure(error: unknown): InconclusiveReason {
  if (!(error instanceof Error)) return "CONSENT_SETUP_FAILED";

  switch (error.message) {
    case "P17_PERFORMANCE_ACQUISITION_SETUP_FAILED":
      return "ACQUISITION_SETUP_FAILED";
    case "P17_PERFORMANCE_CONSENT_ORIGIN_REJECTED":
      return "CONSENT_ORIGIN_REJECTED";
    case "P17_PERFORMANCE_CONSENT_JOURNEY_UNAVAILABLE":
      return "CONSENT_JOURNEY_UNAVAILABLE";
    case "P17_PERFORMANCE_CONSENT_SERVICE_UNAVAILABLE":
      return "CONSENT_SERVICE_UNAVAILABLE";
    case "P17_PERFORMANCE_CONSENT_PROJECTION_INVALID":
      return "CONSENT_PROJECTION_INVALID";
    case "P17_PERFORMANCE_CONSENT_RETURN_NAVIGATION_FAILED":
      return "CONSENT_RETURN_NAVIGATION_FAILED";
    default:
      return "CONSENT_SETUP_FAILED";
  }
}

test.describe("P17-PR03 payment POST initiation", () => {
  let catalogPrepared = false;

  test.beforeAll(async () => {
    assertPerformanceCollectionAuthorized();
    await prepareSyntheticPerformanceCatalog();
    catalogPrepared = true;
  });

  test.afterAll(async () => {
    if (catalogPrepared) await cleanupSyntheticPerformanceCatalog();
  });

  for (const flow of ["PIX", "CREDIT_CARD"] as const) {
    test(`measures ${flow} interaction to browser requestStart`, async ({ browser }, testInfo) => {
      const cohort = cohortForProject(testInfo, "PR03", flow);
      const collection = await collectPerformanceCohort({
        browser,
        testInfo,
        cohort,
        measure: async ({ page, attempt }) => {
          let fixture: Awaited<ReturnType<typeof createPendingPaymentFixture>>;
          try {
            fixture = await createPendingPaymentFixture(attempt);
          } catch {
            return Object.freeze({ state: "INCONCLUSIVE", reason: "FIXTURE_SETUP_FAILED" });
          }

          let stage:
            | "COOKIE_SETUP_FAILED"
            | "PAYMENT_CAPTURE_FAILED"
            | "SYNTHETIC_BRICK_FAILED"
            | "NAVIGATION_FAILED"
            | "CONSENT_SETUP_FAILED"
            | "HYDRATION_WAIT_FAILED"
            | "MARK_TARGET_FAILED"
            | "CLICK_FAILED"
            | "OBSERVER_READ_FAILED"
            | "OUTCOME_NOT_OBSERVED" = "COOKIE_SETUP_FAILED";
          let metric: BrowserMetricResult;

          try {
            await page.context().addCookies([
              {
                name: "lessenc_payment_continuation",
                value: fixture.paymentCookie,
                url: PERFORMANCE_BASE_URL,
                httpOnly: true,
                sameSite: "Lax",
              },
            ]);
            stage = "PAYMENT_CAPTURE_FAILED";
            const paymentCapture = await fulfillSyntheticPaymentStart(page, flow);
            if (flow === "CREDIT_CARD") {
              stage = "SYNTHETIC_BRICK_FAILED";
              await installSyntheticCardBrick(page);
            }

            stage = "NAVIGATION_FAILED";
            const response = await page.goto("/checkout/payment", {
              waitUntil: "domcontentloaded",
            });
            if (response?.status() !== 200) {
              metric = Object.freeze({ state: "INCONCLUSIVE", reason: "NAVIGATION_FAILED" });
            } else {
              stage = "CONSENT_SETUP_FAILED";
              // The payment surface intentionally has no consent preferences panel. The helper
              // still requires a successful canonical DENIED/DENIED API projection before return.
              await denyOptionalMeasurement(page, { requireReturnPageBoundary: false });
              stage = "HYDRATION_WAIT_FAILED";
              await page.waitForLoadState("networkidle");

              if (flow === "PIX") {
                stage = "MARK_TARGET_FAILED";
                await markInteractionTarget(
                  page,
                  'button:has-text("Pagar com Pix")',
                  "payment-start-pix",
                );
                stage = "CLICK_FAILED";
                await observeSyntheticPaymentStartAction(page, async () => {
                  await page.getByRole("button", { name: "Pagar com Pix" }).click();
                });
                stage = "OBSERVER_READ_FAILED";
                await settlePaymentResourceEntries(page);
                metric = await readPaymentPostInitiationMetric(
                  page,
                  "payment-start-pix",
                  flow,
                  paymentCapture.snapshot(),
                );
                if (metric.state !== "VALID") {
                  await testInfo.attach(`p17-${cohort.viewport}-pr03-pix-${attempt}-diagnostic`, {
                    body: Buffer.from(
                      `${JSON.stringify(
                        await readPaymentPostInitiationDiagnostic(
                          page,
                          "payment-start-pix",
                          flow,
                          paymentCapture.snapshot(),
                        ),
                        null,
                        2,
                      )}\n`,
                      "utf8",
                    ),
                    contentType: "application/json",
                  });
                }
                stage = "OUTCOME_NOT_OBSERVED";
                await page.getByText("Aguardando confirmação do pagamento.").waitFor();
              } else {
                stage = "SYNTHETIC_BRICK_FAILED";
                await signalSyntheticSdkReady(page);
                await page.getByRole("button", { name: "Pagar com cartão" }).click();
                const syntheticSubmit = page.getByRole("button", {
                  name: "Enviar cartão sintético",
                });
                await syntheticSubmit.waitFor({ state: "visible" });
                stage = "MARK_TARGET_FAILED";
                await markInteractionTarget(
                  page,
                  '[data-p17-synthetic-card-submit="true"]',
                  "payment-start-card",
                );
                stage = "CLICK_FAILED";
                await observeSyntheticPaymentStartAction(page, async () => {
                  await syntheticSubmit.click();
                });
                stage = "OBSERVER_READ_FAILED";
                await settlePaymentResourceEntries(page);
                metric = await readPaymentPostInitiationMetric(
                  page,
                  "payment-start-card",
                  flow,
                  paymentCapture.snapshot(),
                );
                if (metric.state !== "VALID") {
                  await testInfo.attach(`p17-${cohort.viewport}-pr03-card-${attempt}-diagnostic`, {
                    body: Buffer.from(
                      `${JSON.stringify(
                        await readPaymentPostInitiationDiagnostic(
                          page,
                          "payment-start-card",
                          flow,
                          paymentCapture.snapshot(),
                        ),
                        null,
                        2,
                      )}\n`,
                      "utf8",
                    ),
                    contentType: "application/json",
                  });
                }
                stage = "OUTCOME_NOT_OBSERVED";
                await page.getByText("Aguardando confirmação do pagamento.").waitFor();
              }
            }
          } catch (error) {
            metric = Object.freeze({
              state: "INCONCLUSIVE",
              reason: stage === "CONSENT_SETUP_FAILED" ? consentSetupFailure(error) : stage,
            });
          }

          try {
            await cleanupSyntheticOrder(fixture);
          } catch {
            return Object.freeze({ state: "INCONCLUSIVE", reason: "FIXTURE_CLEANUP_FAILED" });
          }

          return metric;
        },
      });

      await testInfo.attach(`p17-${cohort.viewport}-pr03-${flow.toLowerCase()}-attempts`, {
        body: Buffer.from(`${JSON.stringify(collection, null, 2)}\n`, "utf8"),
        contentType: "application/json",
      });
    });
  }
});
