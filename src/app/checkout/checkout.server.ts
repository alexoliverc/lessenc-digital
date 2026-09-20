import { randomUUID } from "node:crypto";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaCatalogRepository } from "@/infrastructure/database/prisma-catalog-repository";
import { HmacCheckoutSubmissionTokenService } from "@/infrastructure/security/hmac-checkout-submission-token";
import { getP08CommercialEnv, getP09SubmissionEnv } from "@/lib/config/env";
import { createCorrelationId } from "@/lib/observability/correlation";
import { logger } from "@/lib/observability/logger";
import { ResolvePurchasableOffer } from "@/modules/catalog/application/resolve-purchasable-offer";
import {
  createPublicSalesExperience,
  type PublicSalesExperience,
} from "@/modules/sales/application/public-sales-experience";

export type CheckoutInitiationMeasurementContext = Readonly<{
  eventId: string;
  occurredAt: Date;
  productId: string;
  offerId: string;
  amountMinor: number;
  currency: "BRL";
}>;

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

export type CheckoutPageResolution = Readonly<{
  experience: CheckoutPageExperience;
  measurement: CheckoutInitiationMeasurementContext | null;
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

function failedCheckoutResolution(): CheckoutPageResolution {
  return Object.freeze({
    experience: failedCheckoutExperience(),
    measurement: null,
  });
}

export async function resolveCheckoutPageResolution(): Promise<CheckoutPageResolution> {
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

    if (!resolved.ok) {
      if (publicExperience.state === "AVAILABLE") {
        return failedCheckoutResolution();
      }

      return Object.freeze({
        experience: copyNonAvailableExperience(publicExperience),
        measurement: null,
      });
    }

    if (publicExperience.state !== "AVAILABLE") {
      return failedCheckoutResolution();
    }

    const tokenService = new HmacCheckoutSubmissionTokenService(submission.P09_SUBMISSION_SECRET);

    const occurredAt = new Date();
    const submissionId = randomUUID();
    const eventId = randomUUID();

    const token = tokenService.issue({
      submissionId,
      issuedAt: occurredAt.toISOString(),
      presentedAmountMinor: publicExperience.offer.amountMinor,
      presentedCurrency: publicExperience.offer.currency,
    });

    if (!token.ok) {
      logger.error("checkout_token_issue_failed", {
        correlationId: createCorrelationId(),
        surface: "CHECKOUT",
        outcome: "FAILED",
        failureCode: "CHECKOUT_TOKEN_ISSUE_FAILED",
      });
      return failedCheckoutResolution();
    }

    return Object.freeze({
      experience: Object.freeze({
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
      }),
      measurement: Object.freeze({
        eventId,
        occurredAt: new Date(occurredAt.getTime()),
        productId: resolved.value.product.id,
        offerId: resolved.value.offer.id,
        amountMinor: resolved.value.offer.price.amountMinor,
        currency: resolved.value.offer.price.currency,
      }),
    });
  } catch {
    logger.error("checkout_page_resolution_failed", {
      correlationId: createCorrelationId(),
      surface: "CHECKOUT",
      outcome: "FAILED",
      failureCode: "CHECKOUT_PAGE_RESOLUTION_FAILED",
    });

    return failedCheckoutResolution();
  }
}

export async function resolveCheckoutPageExperience(): Promise<CheckoutPageExperience> {
  const resolved = await resolveCheckoutPageResolution();

  return resolved.experience;
}
