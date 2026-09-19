import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaAnalyticsEventRepository } from "@/infrastructure/database/prisma-analytics-event-repository";
import { PrismaCanonicalPurchaseRepository } from "@/infrastructure/database/prisma-canonical-purchase-repository";
import { PrismaPaymentRepository } from "@/infrastructure/database/prisma-payment-repository";
import { MercadoPagoAdapter } from "@/infrastructure/payments/mercado-pago-adapter";
import { HmacPaymentContinuation } from "@/infrastructure/security/hmac-payment-continuation";
import {
  ProjectCanonicalPurchase,
  ReconcileCanonicalPurchases,
} from "@/modules/analytics/application/canonical-purchase";
import { CanonicalPurchaseFinancialObserver } from "@/modules/analytics/application/canonical-purchase-observer";
import { LoadGoogleAdsCanonicalConversionForBrowser } from "@/modules/analytics/application/google-ads-conversion-delivery";
import { LoadMetaPixelCanonicalPurchaseForBrowser } from "@/modules/analytics/application/meta-pixel-delivery";
import { LoadGa4CanonicalPurchaseForBrowser } from "@/modules/analytics/application/google-analytics-4-purchase-delivery";
import { FinancialCoordinator } from "@/modules/payments/application/financial-coordinator";

export async function paymentSession() {
  const secret = process.env.P10_PAYMENT_CONTINUATION_SECRET;
  if (!secret) return null;
  try {
    const service = new HmacPaymentContinuation(secret);
    return service.verify((await cookies()).get("lessenc_payment_continuation")?.value);
  } catch {
    return null;
  }
}

export function paymentServices() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("P10_PROVIDER_UNCONFIGURED");
  const database = getDatabaseClient();
  const repository = new PrismaPaymentRepository(database);
  const purchaseRepository = new PrismaCanonicalPurchaseRepository(database);
  const purchaseProjector = new ProjectCanonicalPurchase(purchaseRepository, randomUUID);
  const purchaseObserver = new CanonicalPurchaseFinancialObserver(purchaseProjector);
  const analyticsEventRepository = new PrismaAnalyticsEventRepository(database);
  const analyticsPurchaseDelivery = new LoadGa4CanonicalPurchaseForBrowser(
    analyticsEventRepository,
  );
  const googleAdsConversionDelivery = new LoadGoogleAdsCanonicalConversionForBrowser(
    analyticsEventRepository,
  );
  const metaPixelPurchaseDelivery = new LoadMetaPixelCanonicalPurchaseForBrowser(
    analyticsEventRepository,
  );

  return {
    repository,
    coordinator: new FinancialCoordinator(
      repository,
      new MercadoPagoAdapter(accessToken),
      purchaseObserver,
    ),
    purchaseReconciliation: new ReconcileCanonicalPurchases(purchaseRepository, purchaseProjector),
    analyticsPurchaseDelivery,
    googleAdsConversionDelivery,
    metaPixelPurchaseDelivery,
  };
}
