import type { Metadata } from "next";
import Link from "next/link";

import { getDatabaseClient } from "@/infrastructure/database/client";
import { PrismaPaymentRepository } from "@/infrastructure/database/prisma-payment-repository";
import { getP13GoogleTagEnv } from "@/lib/config/env";

import { PaymentChoice } from "./payment-choice";
import { paymentSession } from "./payment.server";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pagamento | L'Essenc",
  robots: { index: false, follow: false },
};

export default async function PaymentPage() {
  const claims = await paymentSession();
  if (!claims)
    return (
      <main className={styles.page}>
        <h1>Sessão expirada</h1>
        <p>Reinicie o checkout para continuar com segurança.</p>
        <Link href="/checkout">Voltar ao checkout</Link>
      </main>
    );
  let available: { amount: number; state: string } | null;
  try {
    const db = getDatabaseClient();
    const order = await db.order.findUnique({ where: { id: claims.orderId } });
    if (
      !order ||
      !["PENDING", "PAID", "REFUNDED"].includes(order.status) ||
      order.currency !== "BRL"
    ) {
      throw new Error("ORDER_UNAVAILABLE");
    }
    const state = await new PrismaPaymentRepository(db).state(order.id);
    if (!state) throw new Error("ORDER_UNAVAILABLE");
    available = { amount: order.totalMinor / 100, state: state.state };
  } catch {
    available = null;
  }
  if (!available)
    return (
      <main className={styles.page}>
        <h1>Pagamento indisponível</h1>
        <p>Não foi possível consultar seu pedido agora. Tente novamente mais tarde.</p>
        <Link href="/checkout">Voltar ao checkout</Link>
      </main>
    );
  return (
    <main className={styles.page}>
      <Link href="/checkout">← Checkout</Link>
      <h1>Pagamento do pedido</h1>
      <p>
        Valor do pedido:{" "}
        {available.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
      <PaymentChoice
        initialState={available.state}
        amount={available.amount}
        publicKey={process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? ""}
        gtmContainerId={getP13GoogleTagEnv().GTM_CONTAINER_ID ?? null}
      />
      <p className={styles.note}>O pagamento só será confirmado após verificação no servidor.</p>
    </main>
  );
}
