import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("P17 PR03 interaction lifecycle", () => {
  it("reads browser interaction and request timing before payment UI state replacement", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "pr03-payment-initiation.perf.spec.ts"),
      "utf8",
    );

    expect(source).toContain("denyOptionalMeasurement(page, { requireReturnPageBoundary: false })");
    const hydration = source.indexOf('await page.waitForLoadState("networkidle")');
    expect(hydration).toBeGreaterThanOrEqual(0);

    for (const marker of ["payment-start-pix", "payment-start-card"] as const) {
      const click =
        marker === "payment-start-pix"
          ? source.indexOf('getByRole("button", { name: "Pagar com Pix" }).click();')
          : source.indexOf("await syntheticSubmit.click();");
      const read = source.indexOf("readPaymentPostInitiationMetric(", click);
      const synchronization = source.lastIndexOf("observeSyntheticPaymentStartAction(page", click);
      const resourceFlush = source.indexOf("settlePaymentResourceEntries(page)", click);
      const markerArgument = source.indexOf(`"${marker}"`, read);
      const outcome = source.indexOf(
        'await page.getByText("Aguardando confirmação do pagamento.").waitFor();',
        click,
      );

      expect(click).toBeGreaterThanOrEqual(0);
      expect(click).toBeGreaterThan(hydration);
      expect(synchronization).toBeGreaterThan(hydration);
      expect(synchronization).toBeLessThan(click);
      expect(resourceFlush).toBeGreaterThan(click);
      expect(resourceFlush).toBeLessThan(read);
      expect(read).toBeGreaterThan(click);
      expect(markerArgument).toBeGreaterThan(read);
      expect(markerArgument).toBeLessThan(outcome);
      expect(outcome).toBeGreaterThan(read);
    }
  });
});
