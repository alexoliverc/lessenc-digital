import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { createConnection, type Connection, type ConnectionConfig } from "mariadb";

import { captureBrowserEvidence, expectNoHorizontalOverflow } from "./helpers/evidence";

const productId = "17000000-0000-4000-8000-000000000001";
const offerId = "17000000-0000-4000-8000-000000000002";
const resourceId = "17000000-0000-4000-8000-000000000003";
const buyerEmail = "p17.browser.checkout@example.invalid";

async function connectToTestDatabase(rawUrl: string): Promise<Connection> {
  const url = new URL(rawUrl);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "3307" ||
    database !== "lessenc_test" ||
    !url.username ||
    !url.password ||
    !process.env.DB_TLS_CA_FILE
  ) {
    throw new Error("P17_TEST_DATABASE_TARGET_INVALID");
  }

  const localTestTls = {
    ca: readFileSync(process.env.DB_TLS_CA_FILE),
    rejectUnauthorized: true,
    checkServerIdentity: () => undefined,
  } as NonNullable<ConnectionConfig["ssl"]>;

  return createConnection({
    host: url.hostname,
    port: 3307,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ssl: localTestTls,
  });
}

test("P17-E02/E03/F07 validates checkout, persisted order and duplicate submission", async ({
  page,
}, testInfo) => {
  test.skip(process.env.P17_TARGET !== "local", "P17_STATE_CHANGING_SCENARIO_LOCAL_ONLY");

  test.skip(
    testInfo.project.name !== "chromium-desktop",
    "One isolated write scenario is sufficient",
  );
  test.skip(
    process.env.P17_E2E_DATABASE !== "true",
    "Requires the explicitly guarded P06 test database",
  );

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) throw new Error("P17_TEST_DATABASE_URL_MISSING");

  const database = await connectToTestDatabase(testDatabaseUrl);
  const startedAt = new Date();

  try {
    await database.beginTransaction();
    await database.query(
      `INSERT INTO products (id, name, description, status, created_at, updated_at)
       VALUES (?, ?, ?, 'ACTIVE', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [productId, "Cronograma Capilar Inteligente", "Fixture sintética P17 para browser E2E."],
    );
    await database.query(
      `INSERT INTO offers
         (id, product_id, price_minor, currency, is_active, created_at, updated_at)
       VALUES (?, ?, 2990, 'BRL', TRUE, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [offerId, productId],
    );
    await database.query(
      `INSERT INTO digital_resources
         (id, logical_key, version, storage_key, filename, media_type, status, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?, 'text/plain; charset=utf-8', 'ACTIVE', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))`,
      [
        resourceId,
        "p17-local-checkout-delivery-ready",
        "p17-fixtures/local-checkout-delivery-ready.txt",
        "p17-local-checkout-delivery-ready.txt",
      ],
    );
    await database.query(
      `INSERT INTO product_digital_resources (product_id, resource_id, created_at)
       VALUES (?, ?, UTC_TIMESTAMP(3))`,
      [productId, resourceId],
    );
    await database.commit();

    const productResponse = await page.goto("/cronograma-capilar-inteligente", {
      waitUntil: "networkidle",
    });
    expect(productResponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Pare de cuidar do seu cabelo no improviso.",
    );
    await expectNoHorizontalOverflow(page);

    await page.getByRole("link", { name: "Continuar para o checkout" }).click();
    await expect(page).toHaveURL(/\/checkout$/u);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Registre seu pedido.");

    const email = page.getByLabel("Seu e-mail");
    await email.fill("email-invalido");
    await page.getByRole("button", { name: "Criar pedido" }).click();
    await expect(page.getByText("Informe um e-mail válido.", { exact: true })).toBeVisible();
    const invalidCustomers = (await database.query(
      "SELECT COUNT(*) AS total FROM customers WHERE email = ?",
      ["email-invalido"],
    )) as Array<{ total: bigint }>;
    expect(Number(invalidCustomers[0]?.total ?? 0)).toBe(0);

    await email.fill(buyerEmail);
    await page.getByRole("button", { name: "Criar pedido" }).click();
    await expect(page.getByText("Pedido criado", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Escolher pagamento" })).toBeVisible();

    const orders = (await database.query(
      `SELECT c.id AS customer_id, o.id AS order_id, o.status, o.total_minor, o.currency,
              oi.product_id, oi.offer_id, oi.unit_price_minor, oi.quantity, oi.total_minor AS item_total,
              (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.id) AS payment_count
         FROM customers c
         JOIN orders o ON o.customer_id = c.id
         JOIN order_items oi ON oi.order_id = o.id
        WHERE c.email = ?`,
      [buyerEmail],
    )) as Array<Record<string, string | number | bigint>>;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      status: "PENDING",
      total_minor: 2990,
      currency: "BRL",
      product_id: productId,
      offer_id: offerId,
      unit_price_minor: 2990,
      quantity: 1,
      item_total: 2990,
    });
    expect(Number(orders[0]?.payment_count ?? 0)).toBe(0);

    await expect(email).toBeDisabled();
    await expect(page.getByRole("button", { name: "Pedido registrado" })).toBeDisabled();
    const persistedOrders = (await database.query(
      "SELECT COUNT(*) AS total FROM orders WHERE customer_id = ?",
      [orders[0]?.customer_id],
    )) as Array<{ total: bigint }>;
    expect(Number(persistedOrders[0]?.total ?? 0)).toBe(1);

    await captureBrowserEvidence(page, testInfo, "P17-E02-E03-F07", "/checkout", startedAt);
  } finally {
    await page.waitForTimeout(250);
    await database.query(
      `DELETE oa FROM order_attributions oa
        JOIN orders o ON o.id = oa.order_id
        JOIN customers c ON c.id = o.customer_id
       WHERE c.email = ?`,
      [buyerEmail],
    );
    await database.query(
      `DELETE oi FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN customers c ON c.id = o.customer_id
       WHERE c.email = ?`,
      [buyerEmail],
    );
    await database.query(
      "DELETE o FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.email = ?",
      [buyerEmail],
    );
    await database.query("DELETE FROM customers WHERE email = ?", [buyerEmail]);
    await database.query(
      `DELETE ad FROM analytics_dispatches ad
        JOIN analytics_events ae ON ae.id = ad.analytics_event_id
       WHERE ae.product_id = ? OR ae.offer_id = ?`,
      [productId, offerId],
    );
    await database.query("DELETE FROM analytics_events WHERE product_id = ? OR offer_id = ?", [
      productId,
      offerId,
    ]);
    await database.query("DELETE FROM product_digital_resources WHERE product_id = ?", [productId]);
    await database.query("DELETE FROM digital_resources WHERE id = ?", [resourceId]);
    await database.query("DELETE FROM offers WHERE id = ?", [offerId]);
    await database.query("DELETE FROM products WHERE id = ?", [productId]);
    await database.end();
  }
});
