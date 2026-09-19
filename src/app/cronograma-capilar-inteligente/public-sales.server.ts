import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaCatalogRepository } from "@/infrastructure/database/prisma-catalog-repository";
import { getP08CommercialEnv } from "@/lib/config/env";
import { ResolvePurchasableOffer } from "@/modules/catalog/application/resolve-purchasable-offer";
import {
  createFailedPublicSalesExperience,
  createPublicSalesExperience,
  type PublicSalesExperience,
} from "@/modules/sales/application/public-sales-experience";

export type PublicSalesMeasurementContext = Readonly<{
  productId: string;
  offerId: string;
  amountMinor: number;
  currency: "BRL";
}>;

export type PublicSalesResolution = Readonly<{
  experience: PublicSalesExperience;
  measurement: PublicSalesMeasurementContext | null;
}>;

export async function resolvePublicSalesResolution(): Promise<PublicSalesResolution> {
  try {
    const config = getP08CommercialEnv();
    const database = getDatabaseClient();

    const catalog = new PrismaCatalogRepository(database);
    const resolvePurchasableOffer = new ResolvePurchasableOffer(catalog);

    const result = await resolvePurchasableOffer.execute({
      productId: config.P08_PRODUCT_ID,
      offerId: config.P08_OFFER_ID,
    });

    const experience = createPublicSalesExperience(result);

    if (!result.ok) {
      return Object.freeze({
        experience,
        measurement: null,
      });
    }

    const { product, offer } = result.value;

    return Object.freeze({
      experience,
      measurement: Object.freeze({
        productId: product.id,
        offerId: offer.id,
        amountMinor: offer.price.amountMinor,
        currency: offer.price.currency,
      }),
    });
  } catch {
    console.error("P08_PUBLIC_SALES_RESOLUTION_FAILED");

    return Object.freeze({
      experience: createFailedPublicSalesExperience(),
      measurement: null,
    });
  }
}

export async function resolvePublicSalesExperience(): Promise<PublicSalesExperience> {
  const resolved = await resolvePublicSalesResolution();

  return resolved.experience;
}
