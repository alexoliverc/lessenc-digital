import { cookies } from "next/headers";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaPaymentRepository } from "@/infrastructure/database/prisma-payment-repository";
import { MercadoPagoAdapter } from "@/infrastructure/payments/mercado-pago-adapter";
import { HmacPaymentContinuation } from "@/infrastructure/security/hmac-payment-continuation";
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
  const repository = new PrismaPaymentRepository(getDatabaseClient());
  return {
    repository,
    coordinator: new FinancialCoordinator(repository, new MercadoPagoAdapter(accessToken)),
  };
}
