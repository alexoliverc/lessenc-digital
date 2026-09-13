"use server";

import { randomUUID } from "node:crypto";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaCatalogRepository } from "@/infrastructure/database/prisma-catalog-repository";
import { PrismaCheckoutOrderRepository } from "@/infrastructure/database/prisma-checkout-order-repository";
import { HmacCheckoutSubmissionTokenService } from "@/infrastructure/security/hmac-checkout-submission-token";
import { getP08CommercialEnv, getP09SubmissionEnv } from "@/lib/config/env";
import { ResolvePurchasableOffer } from "@/modules/catalog/application/resolve-purchasable-offer";
import { CreateCheckoutOrder } from "@/modules/commerce/application/create-checkout-order";
import { PrepareOrder } from "@/modules/commerce/application/prepare-order";
import {
  parseCheckoutEmail,
  type CheckoutEmailError,
} from "@/modules/customers/domain/checkout-email";
import { SystemClock } from "@/shared/clock";

import { type CheckoutActionState } from "./checkout-state";

function safeLog(event: string, correlationId: string, code?: string): void {
  const diagnostic =
    code === undefined
      ? {
          event,
          correlationId,
        }
      : {
          event,
          correlationId,
          code,
        };

  console.error(JSON.stringify(diagnostic));
}

function emailErrorMessage(reason: CheckoutEmailError): string {
  switch (reason) {
    case "REQUIRED":
      return "Informe seu e-mail.";

    case "INVALID_TYPE":
    case "INVALID_FORMAT":
    case "TOO_LONG":
      return "Informe um e-mail válido.";
  }
}

function validationFailure(reason: CheckoutEmailError): CheckoutActionState {
  return Object.freeze({
    state: "VALIDATION_ERROR",
    message: "Revise o e-mail informado.",
    emailError: emailErrorMessage(reason),
  });
}

function failedState(): CheckoutActionState {
  return Object.freeze({
    state: "FAILED",
    message: "Não foi possível criar o pedido agora. Tente novamente.",
    emailError: null,
  });
}

export async function createCheckoutOrderAction(
  previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  void previousState;

  const correlationId = randomUUID();

  try {
    const submission = getP09SubmissionEnv();

    const tokenService = new HmacCheckoutSubmissionTokenService(submission.P09_SUBMISSION_SECRET);

    const rawToken = formData.get("submissionToken");

    if (typeof rawToken !== "string") {
      safeLog("checkout.submission.invalid", correlationId);
      return failedState();
    }

    const verified = tokenService.verify(rawToken);

    if (!verified.ok) {
      safeLog("checkout.submission.invalid", correlationId, verified.reason);
      return failedState();
    }

    const parsedEmail = parseCheckoutEmail(formData.get("email"));

    if (!parsedEmail.ok) {
      return validationFailure(parsedEmail.reason);
    }

    const commercial = getP08CommercialEnv();
    const database = getDatabaseClient();

    const resolveOffer = new ResolvePurchasableOffer(new PrismaCatalogRepository(database));

    const prepareOrder = new PrepareOrder(resolveOffer, new SystemClock());

    const createOrder = new CreateCheckoutOrder(
      prepareOrder,
      new PrismaCheckoutOrderRepository(database),
    );

    const result = await createOrder.execute({
      orderId: verified.value.submissionId,
      itemId: randomUUID(),
      customerId: randomUUID(),
      productId: commercial.P08_PRODUCT_ID,
      offerId: commercial.P08_OFFER_ID,
      email: parsedEmail.value,
      presentedAmountMinor: verified.value.presentedAmountMinor,
      presentedCurrency: verified.value.presentedCurrency,
    });

    if (!result.ok) {
      if (
        result.error.code === "PRODUCT_UNAVAILABLE" ||
        result.error.code === "OFFER_UNAVAILABLE"
      ) {
        return Object.freeze({
          state: "UNAVAILABLE",
          message: "Esta oferta não está disponível no momento.",
          emailError: null,
        });
      }

      safeLog("checkout.order.failed", correlationId, result.error.code);

      return failedState();
    }

    switch (result.value.state) {
      case "CREATED":
        return Object.freeze({
          state: "CREATED",
          message: "Pedido criado com sucesso. Nenhum pagamento foi processado nesta etapa.",
          emailError: null,
        });

      case "EXISTING":
        return Object.freeze({
          state: "EXISTING",
          message: "Seu pedido já havia sido criado. Nenhum pagamento foi processado nesta etapa.",
          emailError: null,
        });

      case "PRICE_CHANGED":
        return Object.freeze({
          state: "PRICE_CHANGED",
          message:
            "O valor da oferta foi atualizado. Recarregue a página para revisar o novo preço antes de continuar.",
          emailError: null,
        });

      case "CONFLICT":
        safeLog("checkout.order.conflict", correlationId);
        return failedState();
    }
  } catch {
    safeLog("checkout.order.unexpected_failure", correlationId);
    return failedState();
  }
}
