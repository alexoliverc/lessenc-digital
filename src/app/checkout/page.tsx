import type { Metadata } from "next";
import Link from "next/link";

import { Container, Section, Stack } from "@/components/layout/layout";
import { LinkAction } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/feedback";
import { Surface } from "@/components/ui/surface";

import { CheckoutForm } from "./checkout-form";
import { resolveCheckoutPageExperience } from "./checkout.server";
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
  const experience = await resolveCheckoutPageExperience();

  return (
    <>
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
                <div className={styles.checkoutGrid}>
                  <Surface elevation="raised" padding="spacious" className={styles.summary}>
                    <Stack gap="large">
                      <div>
                        <p className={styles.eyebrow}>Resumo</p>

                        <h2>{experience.product.name}</h2>

                        {experience.product.description && (
                          <p className={styles.description}>{experience.product.description}</p>
                        )}
                      </div>

                      <div className={styles.rule} aria-hidden="true" />

                      <div>
                        <p className={styles.price}>{experience.offer.formattedPrice}</p>

                        <p className={styles.purchaseLabel}>{experience.offer.purchaseLabel}</p>
                      </div>

                      <ul className={styles.summaryList}>
                        <li>Produto digital da L&apos;Essenc.</li>

                        <li>O valor exibido é resolvido novamente no servidor.</li>

                        <li>Esta fase cria um pedido pendente.</li>

                        <li>Nenhum pagamento é processado nesta etapa.</li>
                      </ul>
                    </Stack>
                  </Surface>

                  <Surface padding="spacious" className={styles.formCard}>
                    <Stack gap="large">
                      <div>
                        <p className={styles.eyebrow}>Dados do pedido</p>

                        <h2>Para continuar</h2>

                        <p className={styles.description}>
                          Informe um e-mail válido. Você não precisa criar uma conta nesta etapa.
                        </p>
                      </div>

                      <CheckoutForm submissionToken={experience.submissionToken} />
                    </Stack>
                  </Surface>
                </div>
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
