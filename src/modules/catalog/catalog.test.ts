import { describe, expect, it } from "vitest";

import { ApplicationError } from "../../shared/application-error";
import { catalogFixture } from "../../test-support/p07-fixtures";
import { ResolvePurchasableOffer } from "./application/resolve-purchasable-offer";
import { productStatuses, requirePurchasable, type ProductStatus } from "./domain/catalog";

describe("Catalog eligibility", () => {
  it.each(productStatuses)("only permits ACTIVE product, observed %s", async (status) => {
    const catalog = catalogFixture();
    const service = new ResolvePurchasableOffer({
      findOffer: async () => ({ ...catalog, product: { ...catalog.product, status } }),
    });
    const result = await service.execute({ productId: "product", offerId: "offer" });
    expect(result.ok).toBe(status === "ACTIVE");
    if (!result.ok) expect(result.error.code).toBe("PRODUCT_UNAVAILABLE");
  });
  it("rejects inactive offer, missing offer and either product association mismatch", async () => {
    const catalog = catalogFixture();
    expect(() =>
      requirePurchasable({ ...catalog, offer: { ...catalog.offer, isActive: false } }, "product"),
    ).toThrow(expect.objectContaining({ code: "OFFER_UNAVAILABLE" }));
    expect(() =>
      requirePurchasable(
        { ...catalog, offer: { ...catalog.offer, productId: "different" } },
        "product",
      ),
    ).toThrow(expect.objectContaining({ code: "OFFER_PRODUCT_MISMATCH" }));
    expect(() => requirePurchasable(catalog, "different")).toThrow(
      expect.objectContaining({ code: "OFFER_PRODUCT_MISMATCH" }),
    );
    const missing = await new ResolvePurchasableOffer({ findOffer: async () => null }).execute({
      productId: "product",
      offerId: "missing",
    });
    expect(missing).toMatchObject({ ok: false, error: { code: "OFFER_UNAVAILABLE" } });
  });
  it("checks returned offer identity and preserves typed repository failures", async () => {
    const input = { productId: "product", offerId: "other" };
    expect(
      await new ResolvePurchasableOffer({ findOffer: async () => catalogFixture() }).execute(input),
    ).toMatchObject({ ok: false });
    expect(
      await new ResolvePurchasableOffer({
        findOffer: async () => {
          throw new ApplicationError("PERSISTENCE_UNAVAILABLE", "catalog-read");
        },
      }).execute(input),
    ).toMatchObject({ ok: false, error: { code: "PERSISTENCE_UNAVAILABLE" } });
  });
  it("rejects historical or unexpected product states explicitly", () => {
    const catalog = catalogFixture();
    expect(() =>
      requirePurchasable(
        { ...catalog, product: { ...catalog.product, status: "PUBLISHED" as ProductStatus } },
        "product",
      ),
    ).toThrow("Unexpected internal discriminant");
  });
});
