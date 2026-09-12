import { ApplicationError } from "../../../shared/application-error";
import { attemptAsync } from "../../../shared/result";
import { requirePurchasable, type CatalogOffer } from "../domain/catalog";

export interface CatalogRepository {
  findOffer(offerId: string): Promise<CatalogOffer | null>;
}

export class ResolvePurchasableOffer {
  constructor(private readonly catalog: CatalogRepository) {}

  execute(input: Readonly<{ productId: string; offerId: string }>) {
    return attemptAsync(async () => {
      const selected = await this.catalog.findOffer(input.offerId);
      if (!selected) throw new ApplicationError("OFFER_UNAVAILABLE");
      if (selected.offer.id !== input.offerId) {
        throw new ApplicationError("OFFER_UNAVAILABLE");
      }
      requirePurchasable(selected, input.productId);
      return Object.freeze({
        product: Object.freeze({ ...selected.product }),
        offer: Object.freeze({ ...selected.offer }),
      });
    });
  }
}
