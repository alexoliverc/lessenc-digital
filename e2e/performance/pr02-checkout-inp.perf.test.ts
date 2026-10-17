import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("P17 PR02 interaction lifecycle", () => {
  it("reads Event Timing before the Server Action outcome can replace browser state", () => {
    const source = readFileSync(
      resolve(import.meta.dirname, "pr02-checkout-inp.perf.spec.ts"),
      "utf8",
    );
    const hydration = source.indexOf('await page.waitForLoadState("networkidle")');
    const mark = source.indexOf("await markInteractionTarget(");
    const bounds = source.indexOf("const bounds = await submitButton.boundingBox();");
    const alignment = source.indexOf("await alignInteractionAfterFrame(page);");
    const click = source.indexOf("await page.mouse.click(");
    const settle = source.indexOf("await settleInteractionEntries(page);");
    const read = source.indexOf('metric = await readInpMetric(page, "checkout-create-order");');
    const outcome = source.indexOf('await page.getByText("Pedido criado"');

    expect(hydration).toBeGreaterThanOrEqual(0);
    expect(mark).toBeGreaterThan(hydration);
    expect(bounds).toBeGreaterThan(mark);
    expect(alignment).toBeGreaterThan(bounds);
    expect(click).toBeGreaterThan(alignment);
    expect(settle).toBeGreaterThan(click);
    expect(read).toBeGreaterThan(settle);
    expect(outcome).toBeGreaterThan(read);
    expect(source).not.toContain(
      'await page.getByRole("button", { name: "Criar pedido" }).click();',
    );
    expect(source.indexOf('stage = "SETTLE_INTERACTION_FAILED";')).toBeLessThan(settle);
    expect(source.indexOf('stage = "OBSERVER_READ_FAILED";')).toBeGreaterThan(settle);
  });

  it("associates Event Timing by captured timestamp before consulting a removable DOM target", () => {
    const source = readFileSync(resolve(import.meta.dirname, "helpers/browser-metrics.ts"), "utf8");
    const observedMarker = source.indexOf("const observedMarker = state.markerEvents.find(");
    const targetFallback = source.indexOf("if (observedMarker === undefined)");

    expect(observedMarker).toBeGreaterThanOrEqual(0);
    expect(targetFallback).toBeGreaterThan(observedMarker);
    expect(source).toContain(
      "A detached Event Timing target must not make observer flushing throw",
    );
  });
});
