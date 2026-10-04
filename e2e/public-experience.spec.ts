import { expect, test } from "@playwright/test";

import { captureBrowserEvidence, expectNoHorizontalOverflow } from "./helpers/evidence";

test.describe("P17 public experience real-browser baseline", () => {
  test("P17-E01 renders an accessible and usable public journey entry", async ({
    page,
  }, testInfo) => {
    const startedAt = new Date();
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.name));

    const response = await page.goto("/", { waitUntil: "networkidle" });

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Seu cabelo não precisa de mais improviso.",
    );
    const primaryCta = page.getByRole("link", { name: "Conhecer o cronograma" }).first();
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toHaveAttribute("href", "/cronograma-capilar-inteligente");
    await expectNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);

    await captureBrowserEvidence(page, testInfo, "P17-E01", "/", startedAt);
  });

  test("P17-P03/P17-P04 enforces the public CSP without unsafe-eval", async ({
    page,
  }, testInfo) => {
    const startedAt = new Date();
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    const csp = response?.headers()["content-security-policy"] ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(response?.headers()["x-content-type-options"]).toBe("nosniff");

    await captureBrowserEvidence(page, testInfo, "P17-P03-P04", "/", startedAt);
  });

  test("P17-R01/R02/R03 keeps keyboard entry and critical CTA usable", async ({
    page,
  }, testInfo) => {
    const startedAt = new Date();
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.keyboard.press("Tab");

    const skipLink = page.getByRole("link", { name: "Pular para o conteúdo" });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
    await expect(page.getByRole("link", { name: "Conhecer o cronograma" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await captureBrowserEvidence(page, testInfo, "P17-R01-R02-R03", "/", startedAt);
  });

  test("public liveness remains exact and non-cacheable", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
