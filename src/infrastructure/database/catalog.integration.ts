import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ResolvePurchasableOffer } from "../../modules/catalog/application/resolve-purchasable-offer";
import { productStatuses } from "../../modules/catalog/domain/catalog";
import { PrepareOrder } from "../../modules/commerce/application/prepare-order";
import { fixedClock } from "../../test-support/p07-fixtures";
import { createDatabaseClient } from "./client";
import { PrismaCatalogRepository } from "./prisma-catalog-repository";

describe("P07 catalog adapter on isolated P06 MySQL", () => {
  let database: ReturnType<typeof createDatabaseClient>;
  let resolveOffer: ResolvePurchasableOffer;
  const productId = randomUUID();
  const offerId = randomUUID();
  const input = {
    productId,
    offerId,
    orderId: randomUUID(),
    itemId: randomUUID(),
    customerId: randomUUID(),
    quantity: 1,
  };

  beforeAll(async () => {
    // Run the existing P06 guard even if Vitest is invoked without the npm wrapper.
    execFileSync(process.execPath, ["scripts/p06-db-guard.mjs", "test"], { stdio: "pipe" });
    database = createDatabaseClient(process.env.TEST_DATABASE_URL!);
    await database.product.create({
      data: {
        id: productId,
        name: "Cronograma Capilar Inteligente",
        description: "Descrição original P07",
        status: "ACTIVE",
        offers: { create: { id: offerId, priceMinor: 2990, currency: "BRL", isActive: true } },
      },
    });
    resolveOffer = new ResolvePurchasableOffer(new PrismaCatalogRepository(database));
  });

  afterAll(async () => {
    if (!database) return;
    try {
      await database.offer.deleteMany({ where: { id: offerId } });
      await database.product.deleteMany({ where: { id: productId } });
      expect(await database.offer.count({ where: { id: offerId } })).toBe(0);
      expect(await database.product.count({ where: { id: productId } })).toBe(0);
    } finally {
      await database.$disconnect();
    }
  });

  it("maps canonical price and nullable description, preserving prepared historical snapshot", async () => {
    const prepare = new PrepareOrder(resolveOffer, fixedClock);
    const original = await prepare.execute(input);
    expect(original).toMatchObject({
      ok: true,
      value: {
        total: { amountMinor: 2990, currency: "BRL" },
        items: [{ productDescriptionSnapshot: "Descrição original P07" }],
      },
    });
    await database.$transaction([
      database.offer.update({ where: { id: offerId }, data: { priceMinor: 3990 } }),
      database.product.update({
        where: { id: productId },
        data: { name: "Nome alterado P07", description: null },
      }),
    ]);
    expect(await prepare.execute(input)).toMatchObject({
      ok: true,
      value: {
        total: { amountMinor: 3990 },
        items: [{ productDescriptionSnapshot: null, productNameSnapshot: "Nome alterado P07" }],
      },
    });
    expect(original).toMatchObject({
      ok: true,
      value: {
        total: { amountMinor: 2990 },
        items: [
          {
            productDescriptionSnapshot: "Descrição original P07",
            productNameSnapshot: "Cronograma Capilar Inteligente",
          },
        ],
      },
    });
  });

  it.each(productStatuses)("maps physical product status %s explicitly", async (status) => {
    await database.product.update({ where: { id: productId }, data: { status } });
    const result = await resolveOffer.execute(input);
    expect(result.ok).toBe(status === "ACTIVE");
    if (!result.ok) expect(result.error.code).toBe("PRODUCT_UNAVAILABLE");
  });

  it("rejects inactive offers, association mismatch and missing offers through application errors", async () => {
    await database.product.update({ where: { id: productId }, data: { status: "ACTIVE" } });
    await database.offer.update({ where: { id: offerId }, data: { isActive: false } });
    expect(await resolveOffer.execute(input)).toMatchObject({
      ok: false,
      error: { code: "OFFER_UNAVAILABLE" },
    });
    expect(await resolveOffer.execute({ productId: randomUUID(), offerId })).toMatchObject({
      ok: false,
      error: { code: "OFFER_PRODUCT_MISMATCH" },
    });
    expect(await resolveOffer.execute({ productId, offerId: randomUUID() })).toMatchObject({
      ok: false,
      error: { code: "OFFER_UNAVAILABLE" },
    });
  });

  it("rejects a persisted currency outside the commercial baseline", async () => {
    await database.offer.update({
      where: { id: offerId },
      data: { isActive: true, currency: "USD" },
    });
    expect(await resolveOffer.execute(input)).toMatchObject({
      ok: false,
      error: { code: "UNSUPPORTED_CURRENCY" },
    });
  });
});
