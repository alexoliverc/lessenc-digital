import type { ResolvePurchasableOffer } from "../../catalog/application/resolve-purchasable-offer";

type ResolvePurchasableOfferResult = Awaited<ReturnType<ResolvePurchasableOffer["execute"]>>;

type AvailablePublicSalesExperience = Readonly<{
  state: "AVAILABLE";
  product: Readonly<{
    name: string;
    description: string | null;
  }>;
  offer: Readonly<{
    amountMinor: number;
    currency: "BRL";
    formattedPrice: string;
    purchaseLabel: "Pagamento único";
  }>;
}>;

type UnavailablePublicSalesExperience = Readonly<{
  state: "UNAVAILABLE";
  title: string;
  description: string;
}>;

type FailedPublicSalesExperience = Readonly<{
  state: "FAILED";
  title: string;
  description: string;
}>;

export type PublicSalesExperience =
  AvailablePublicSalesExperience | UnavailablePublicSalesExperience | FailedPublicSalesExperience;

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatBrl(amountMinor: number): string {
  return brlFormatter.format(amountMinor / 100).replace(/\s+/gu, " ");
}

function unavailableExperience(): UnavailablePublicSalesExperience {
  return Object.freeze({
    state: "UNAVAILABLE",
    title: "Oferta indisponível",
    description: "Esta oferta não está disponível no momento.",
  });
}

export function createFailedPublicSalesExperience(): FailedPublicSalesExperience {
  return Object.freeze({
    state: "FAILED",
    title: "Não foi possível carregar a oferta",
    description: "Tente novamente mais tarde.",
  });
}

export function createPublicSalesExperience(
  result: ResolvePurchasableOfferResult,
): PublicSalesExperience {
  if (!result.ok) {
    if (result.error.code === "PRODUCT_UNAVAILABLE" || result.error.code === "OFFER_UNAVAILABLE") {
      return unavailableExperience();
    }

    return createFailedPublicSalesExperience();
  }

  const { product, offer } = result.value;

  return Object.freeze({
    state: "AVAILABLE",
    product: Object.freeze({
      name: product.name,
      description: product.description,
    }),
    offer: Object.freeze({
      amountMinor: offer.price.amountMinor,
      currency: offer.price.currency,
      formattedPrice: formatBrl(offer.price.amountMinor),
      purchaseLabel: "Pagamento único",
    }),
  });
}
