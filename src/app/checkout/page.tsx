import type { Metadata } from "next";
import Link from "next/link";

import { AnalyticsConsentBoundary } from "@/components/analytics/analytics-consent-boundary";
import { Container, Section, Stack } from "@/components/layout/layout";
import { LinkAction } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/feedback";

import { CheckoutForm } from "./checkout-form";
import { resolveCheckoutPageResolution } from "./checkout.server";
import { scheduleCheckoutInitiation } from "./initiate-checkout.server";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout | L'Essenc",
  description:
    "Finalize os dados necessários para registrar seu pedido do Cronograma Capilar Inteligente.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutPage() {
  const resolved = await resolveCheckoutPageResolution();

  const { experience, measurement } = resolved;

  const browserMeasurement =
    measurement === null ? null : await scheduleCheckoutInitiation(measurement);

  return (
    <>
      <AnalyticsConsentBoundary boundary={browserMeasurement} />

      <a href="#checkout" className={styles.skipLink}>
        Pular para o checkout
      </a>

      <header className={styles.header}>
        <Container size="wide" className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="L'Essenc, início">
            L&apos;Essenc
            <small>Digital</small>
          </Link>

          <LinkAction href="/cronograma-capilar-inteligente" variant="ghost" size="small">
            Voltar ao produto
          </LinkAction>
        </Container>
      </header>

      <main id="checkout">
        <Section className={styles.checkoutSection}>
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.heading}>
                <p className={styles.eyebrow}>Checkout L&apos;Essenc</p>

                <h1>Registre seu pedido.</h1>

                <p className={styles.lead}>
                  Confira a oferta atual e informe o e-mail que ficará associado a este pedido.
                </p>
              </div>

              {experience.state === "AVAILABLE" ? (
                <CheckoutForm
                  submissionToken={experience.submissionToken}
                  product={experience.product}
                  offer={experience.offer}
                />
              ) : experience.state === "UNAVAILABLE" ? (
                <StatePanel
                  kind="empty"
                  title={experience.title}
                  description={experience.description}
                  className={styles.statePanel}
                >
                  <LinkAction href="/cronograma-capilar-inteligente" variant="outline">
                    Voltar ao produto
                  </LinkAction>
                </StatePanel>
              ) : (
                <StatePanel
                  kind="error"
                  title={experience.title}
                  description={experience.description}
                  className={styles.statePanel}
                >
                  <LinkAction href="/cronograma-capilar-inteligente" variant="outline">
                    Voltar ao produto
                  </LinkAction>
                </StatePanel>
              )}
            </Stack>
          </Container>
        </Section>
      </main>

      <footer className={styles.footer}>
        <Container size="wide" className={styles.footerInner}>
          <Link href="/">L&apos;Essenc</Link>
          <p>Cuidado com intenção.</p>
        </Container>
      </footer>
    </>
  );
}
