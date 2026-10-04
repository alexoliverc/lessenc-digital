import { expect, test } from "@playwright/test";

import { captureBrowserEvidence } from "./helpers/evidence";

test("P17-B01/A01/A04 rejects invalid buyer and admin identities without bypass", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "One isolated security run is sufficient",
  );
  test.skip(
    process.env.P17_E2E_DATABASE !== "true",
    "Requires the explicitly guarded P06 test database",
  );

  const startedAt = new Date();
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login$/u);
  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();

  await page.getByLabel("E-mail").fill("p17.unknown.admin@example.invalid");
  await page.getByLabel("Senha").fill("synthetic-invalid-password");
  await page.getByRole("button", { name: "Entrar com segurança" }).click();
  await expect(
    page.getByText("Não foi possível autenticar. Verifique os dados e tente novamente.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await page.context().cookies()).some((cookie) => cookie.name.includes("lessenc_admin")),
  ).toBe(false);

  await page.goto("/");
  const buyerResult = await page.evaluate(async () => {
    const response = await fetch("/api/buyer-access/exchange", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: `lba_${"a".repeat(43)}` }),
    });

    return {
      status: response.status,
      body: (await response.json()) as unknown,
      cacheControl: response.headers.get("cache-control"),
    };
  });

  expect(buyerResult).toEqual({
    status: 401,
    body: { error: "ACCESS_INVALID" },
    cacheControl: "private, no-store",
  });
  expect(
    (await page.context().cookies()).some((cookie) => cookie.name.includes("lessenc_buyer")),
  ).toBe(false);

  await captureBrowserEvidence(page, testInfo, "P17-B01-A01-A04", "/admin,/", startedAt);
});
