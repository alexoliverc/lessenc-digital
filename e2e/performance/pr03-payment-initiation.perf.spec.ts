import { test } from "@playwright/test";

import {
  cleanupSyntheticOrder,
  cleanupSyntheticPerformanceCatalog,
  createPendingPaymentFixture,
  prepareSyntheticPerformanceCatalog,
} from "./fixtures/synthetic-business-state";
import {
  markInteractionTarget,
  readPaymentPostInitiationMetric,
  settleInteractionEntries,
} from "./helpers/browser-metrics";
import {
  fulfillSyntheticPaymentStart,
  denyOptionalMeasurement,
  installSyntheticCardBrick,
  signalSyntheticSdkReady,
} from "./helpers/browser-network-guard";
import { PERFORMANCE_BASE_URL } from "./helpers/isolation";
import { assertPerformanceCollectionAuthorized } from "./helpers/orchestration";
import { cohortForProject, collectPerformanceCohort } from "./helpers/spec-support";

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
          const fixture = await createPendingPaymentFixture(attempt);

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
            const paymentCapture = await fulfillSyntheticPaymentStart(page);
            if (flow === "CREDIT_CARD") await installSyntheticCardBrick(page);

            const response = await page.goto("/checkout/payment", {
              waitUntil: "domcontentloaded",
            });
            if (response?.status() !== 200) {
              return Object.freeze({ state: "INCONCLUSIVE", reason: "ENTRY_MISSING" });
            }
            await denyOptionalMeasurement(page);

            if (flow === "PIX") {
              await markInteractionTarget(
                page,
                'button:has-text("Pagar com Pix")',
                "payment-start-pix",
              );
              await page.getByRole("button", { name: "Pagar com Pix" }).click();
              await page.getByText("Aguardando confirmação do pagamento.").waitFor();
              await settleInteractionEntries(page);
              return readPaymentPostInitiationMetric(
                page,
                "payment-start-pix",
                paymentCapture.snapshot(),
              );
            }

            await signalSyntheticSdkReady(page);
            await page.getByRole("button", { name: "Pagar com cartão" }).click();
            const syntheticSubmit = page.getByRole("button", {
              name: "Enviar cartão sintético",
            });
            await syntheticSubmit.waitFor({ state: "visible" });
            await markInteractionTarget(
              page,
              '[data-p17-synthetic-card-submit="true"]',
              "payment-start-card",
            );
            await syntheticSubmit.click();
            await page.getByText("Aguardando confirmação do pagamento.").waitFor();
            await settleInteractionEntries(page);
            return readPaymentPostInitiationMetric(
              page,
              "payment-start-card",
              paymentCapture.snapshot(),
            );
          } finally {
            await cleanupSyntheticOrder(fixture);
          }
        },
      });

      await testInfo.attach(`p17-${cohort.viewport}-pr03-${flow.toLowerCase()}-attempts`, {
        body: Buffer.from(`${JSON.stringify(collection, null, 2)}\n`, "utf8"),
        contentType: "application/json",
      });
    });
  }
});
