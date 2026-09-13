import { describe, expect, it } from "vitest";

import { ApplicationError } from "../../../shared/application-error";
import { Money } from "../../../shared/money";
import {
  createFailedPublicSalesExperience,
  createPublicSalesExperience,
} from "./public-sales-experience";

function availableResult() {
  return {
    ok: true as const,
    value: Object.freeze({
      product: Object.freeze({
        id: "product-private-id",
        name: "Cronograma Capilar Inteligente",
        description: "Um método prático para organizar os cuidados capilares.",
        status: "ACTIVE" as const,
      }),
      offer: Object.freeze({
        id: "offer-private-id",
        productId: "product-private-id",
        price: Money.of(2990, "BRL"),
        isActive: true,
      }),
    }),
  };
}

describe("createFailedPublicSalesExperience", () => {
  it("creates the safe generic FAILED public state", () => {
    expect(createFailedPublicSalesExperience()).toEqual({
      state: "FAILED",
      title: "Não foi possível carregar a oferta",
      description: "Tente novamente mais tarde.",
    });
  });
});

describe("createPublicSalesExperience", () => {
  it("creates AVAILABLE from authoritative P07 product and offer data", () => {
    const result = createPublicSalesExperience(availableResult());

    expect(result).toEqual({
      state: "AVAILABLE",
      product: {
        name: "Cronograma Capilar Inteligente",
        description: "Um método prático para organizar os cuidados capilares.",
      },
      offer: {
        amountMinor: 2990,
        currency: "BRL",
        formattedPrice: "R$ 29,90",
        purchaseLabel: "Pagamento único",
      },
    });
  });

  it("does not expose persistence identifiers in the AVAILABLE public model", () => {
    const result = createPublicSalesExperience(availableResult());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("product-private-id");
    expect(serialized).not.toContain("offer-private-id");
  });

  it.each(["PRODUCT_UNAVAILABLE", "OFFER_UNAVAILABLE"] as const)(
    "maps %s to UNAVAILABLE without a price fallback",
    (code) => {
      const result = createPublicSalesExperience({
        ok: false,
        error: new ApplicationError(code),
      });

      expect(result).toEqual({
        state: "UNAVAILABLE",
        title: "Oferta indisponível",
        description: "Esta oferta não está disponível no momento.",
      });

      expect(JSON.stringify(result)).not.toContain("2990");
      expect(JSON.stringify(result)).not.toContain("R$");
    },
  );

  it("maps persistence failure to FAILED without exposing diagnostics", () => {
    const result = createPublicSalesExperience({
      ok: false,
      error: new ApplicationError("PERSISTENCE_UNAVAILABLE", "catalog-read"),
    });

    expect(result).toEqual({
      state: "FAILED",
      title: "Não foi possível carregar a oferta",
      description: "Tente novamente mais tarde.",
    });

    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("PERSISTENCE_UNAVAILABLE");
    expect(serialized).not.toContain("catalog-read");
    expect(serialized).not.toContain("2990");
  });

  it("maps product/offer integrity mismatch to FAILED", () => {
    expect(
      createPublicSalesExperience({
        ok: false,
        error: new ApplicationError("OFFER_PRODUCT_MISMATCH"),
      }),
    ).toEqual({
      state: "FAILED",
      title: "Não foi possível carregar a oferta",
      description: "Tente novamente mais tarde.",
    });
  });

  it("preserves a nullable authoritative product description", () => {
    const source = availableResult();

    const result = createPublicSalesExperience({
      ...source,
      value: {
        ...source.value,
        product: {
          ...source.value.product,
          description: null,
        },
      },
    });

    expect(result).toMatchObject({
      state: "AVAILABLE",
      product: {
        description: null,
      },
    });
  });
});
