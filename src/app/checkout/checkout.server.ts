import { randomUUID } from "node:crypto";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaCatalogRepository } from "@/infrastructure/database/prisma-catalog-repository";
import { HmacCheckoutSubmissionTokenService } from "@/infrastructure/security/hmac-checkout-submission-token";
import { getP08CommercialEnv, getP09SubmissionEnv } from "@/lib/config/env";
import { ResolvePurchasableOffer } from "@/modules/catalog/application/resolve-purchasable-offer";
import {
  createPublicSalesExperience,
  type PublicSalesExperience,
} from "@/modules/sales/application/public-sales-experience";

export type CheckoutPageExperience =
  | Readonly<{
      state: "AVAILABLE";
      product: Readonly<{
        name: string;
        description: string | null;
      }>;
      offer: Readonly<{
        formattedPrice: string;
        purchaseLabel: string;
      }>;
      submissionToken: string;
    }>
  | Readonly<{
      state: "UNAVAILABLE";
      title: string;
      description: string;
    }>
  | Readonly<{
      state: "FAILED";
      title: string;
      description: string;
    }>;

function failedCheckoutExperience(): CheckoutPageExperience {
  return Object.freeze({
    state: "FAILED",
    title: "Não foi possível iniciar o checkout",
    description: "Atualize a página e tente novamente.",
  });
}

function copyNonAvailableExperience(
  experience: Exclude<PublicSalesExperience, { state: "AVAILABLE" }>,
): CheckoutPageExperience {
  return Object.freeze({
    state: experience.state,
    title: experience.title,
    description: experience.description,
  });
}

export async function resolveCheckoutPageExperience(): Promise<CheckoutPageExperience> {
  try {
    const commercial = getP08CommercialEnv();
    const submission = getP09SubmissionEnv();

    const database = getDatabaseClient();

    const resolveOffer = new ResolvePurchasableOffer(new PrismaCatalogRepository(database));

    const resolved = await resolveOffer.execute({
      productId: commercial.P08_PRODUCT_ID,
      offerId: commercial.P08_OFFER_ID,
    });

    const publicExperience = createPublicSalesExperience(resolved);

    if (publicExperience.state !== "AVAILABLE") {
      return copyNonAvailableExperience(publicExperience);
    }

    const tokenService = new HmacCheckoutSubmissionTokenService(submission.P09_SUBMISSION_SECRET);

    const token = tokenService.issue({
      submissionId: randomUUID(),
      issuedAt: new Date().toISOString(),
      presentedAmountMinor: publicExperience.offer.amountMinor,
      presentedCurrency: publicExperience.offer.currency,
    });

    if (!token.ok) {
      console.error("P09_CHECKOUT_TOKEN_ISSUE_FAILED");
      return failedCheckoutExperience();
    }

    return Object.freeze({
      state: "AVAILABLE",
      product: Object.freeze({
        name: publicExperience.product.name,
        description: publicExperience.product.description,
      }),
      offer: Object.freeze({
        formattedPrice: publicExperience.offer.formattedPrice,
        purchaseLabel: publicExperience.offer.purchaseLabel,
      }),
      submissionToken: token.token,
    });
  } catch {
    console.error("P09_CHECKOUT_PAGE_RESOLUTION_FAILED");
    return failedCheckoutExperience();
  }
}
