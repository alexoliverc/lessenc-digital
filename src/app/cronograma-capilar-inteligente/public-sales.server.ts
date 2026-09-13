import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaCatalogRepository } from "@/infrastructure/database/prisma-catalog-repository";
import { getP08CommercialEnv } from "@/lib/config/env";
import { ResolvePurchasableOffer } from "@/modules/catalog/application/resolve-purchasable-offer";
import {
  createFailedPublicSalesExperience,
  createPublicSalesExperience,
  type PublicSalesExperience,
} from "@/modules/sales/application/public-sales-experience";

export async function resolvePublicSalesExperience(): Promise<PublicSalesExperience> {
  try {
    const config = getP08CommercialEnv();
    const database = getDatabaseClient();

    const catalog = new PrismaCatalogRepository(database);
    const resolvePurchasableOffer = new ResolvePurchasableOffer(catalog);

    const result = await resolvePurchasableOffer.execute({
      productId: config.P08_PRODUCT_ID,
      offerId: config.P08_OFFER_ID,
    });

    return createPublicSalesExperience(result);
  } catch {
    console.error("P08_PUBLIC_SALES_RESOLUTION_FAILED");

    return createFailedPublicSalesExperience();
  }
}
