import { expect, type Page, type TestInfo } from "@playwright/test";

type BrowserEvidence = Readonly<{
  scenarioId: string;
  route: string;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  browserEngine: string;
  browserVersion: string;
  viewport: Readonly<{ width: number; height: number }> | null;
  environment: string;
  result: "PASS";
}>;

export async function captureBrowserEvidence(
  page: Page,
  testInfo: TestInfo,
  scenarioId: string,
  route: string,
  startedAt: Date,
): Promise<void> {
  const finishedAt = new Date();
  const evidence: BrowserEvidence = {
    scenarioId,
    route,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
    browserEngine: page.context().browser()?.browserType().name() ?? "unknown",
    browserVersion: page.context().browser()?.version() ?? "unknown",
    viewport: page.viewportSize(),
    environment: process.env.P17_TARGET ?? "local",
    result: "PASS",
  };

  await testInfo.attach(`${scenarioId}-evidence`, {
    body: Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`, "utf8"),
    contentType: "application/json",
  });
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.documentWidth).toBeLessThanOrEqual(overflow.viewportWidth + 1);
}
