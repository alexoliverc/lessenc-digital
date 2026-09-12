import { ApplicationError } from "../../../shared/application-error";
import { assertNever } from "../../../shared/assert-never";
import { Money } from "../../../shared/money";

export const productStatuses = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProductStatus = (typeof productStatuses)[number];
export type Product = Readonly<{
  id: string;
  name: string;
  description: string | null;
  status: ProductStatus;
}>;
export type Offer = Readonly<{
  id: string;
  productId: string;
  price: Money;
  isActive: boolean;
}>;
export type CatalogOffer = Readonly<{ product: Product; offer: Offer }>;

export function requirePurchasable(catalog: CatalogOffer, productId: string): void {
  const { product, offer } = catalog;
  if (offer.productId !== product.id || product.id !== productId) {
    throw new ApplicationError("OFFER_PRODUCT_MISMATCH");
  }
  switch (product.status) {
    case "ACTIVE":
      break;
    case "DRAFT":
    case "INACTIVE":
    case "ARCHIVED":
      throw new ApplicationError("PRODUCT_UNAVAILABLE");
    default:
      assertNever(product.status);
  }
  if (!offer.isActive) throw new ApplicationError("OFFER_UNAVAILABLE");
  offer.price.requireCurrency("BRL");
}
