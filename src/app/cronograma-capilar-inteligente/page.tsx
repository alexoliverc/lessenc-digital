import type { Metadata } from "next";
import Link from "next/link";

import { Container, Grid, Section, Stack } from "@/components/layout/layout";
import { LinkAction } from "@/components/ui/button";
import { StatePanel } from "@/components/ui/feedback";
import { Surface } from "@/components/ui/surface";
import type { PublicSalesExperience } from "@/modules/sales/application/public-sales-experience";

import { resolvePublicSalesExperience } from "./public-sales.server";
import styles from "./page.module.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pageTitle = "Cronograma Capilar Inteligente | L'Essenc";
const pageDescription =
  "Entenda hidratação, nutrição e reconstrução e organize uma rotina capilar com mais clareza e intenção.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/cronograma-capilar-inteligente",
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: "/cronograma-capilar-inteligente",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

function CommercialState({
  experience,
}: Readonly<{
  experience: PublicSalesExperience;
}>) {
  if (experience.state === "AVAILABLE") {
    return (
      <Surface elevation="raised" padding="spacious" className={styles.offerCard}>
        <Stack gap="large">
          <div>
            <p className={styles.eyebrow}>Oferta atual</p>
            <p className={styles.offerPrice}>{experience.offer.formattedPrice}</p>
            <p className={styles.offerLabel}>{experience.offer.purchaseLabel}</p>
          </div>

          <div className={styles.offerRule} aria-hidden="true" />

          <Stack gap="small">
            <strong>{experience.product.name}</strong>
            <p>
              Acesso ao conteúdo digital apresentado nesta página. O checkout cria um pedido
              pendente; nenhum pagamento é processado nesta etapa.
            </p>
          </Stack>

          <LinkAction href="/checkout">Continuar para o checkout</LinkAction>
        </Stack>
      </Surface>
    );
  }

  if (experience.state === "UNAVAILABLE") {
    return (
      <StatePanel
        kind="empty"
        title={experience.title}
        description={experience.description}
        className={styles.statePanel}
      >
        <p>Você ainda pode conhecer o método e o conteúdo apresentado nesta página.</p>
      </StatePanel>
    );
  }

  return (
    <StatePanel
      kind="error"
      title={experience.title}
      description={experience.description}
      className={styles.statePanel}
    >
      <p>O conteúdo informativo continua disponível enquanto a oferta é carregada novamente.</p>
    </StatePanel>
  );
}

export default async function CronogramaCapilarInteligentePage() {
  const experience = await resolvePublicSalesExperience();

  return (
    <>
      <a href="#conteudo" className={styles.skipLink}>
        Pular para o conteúdo
      </a>

      <header className={styles.header}>
        <Container size="wide" className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label="L'Essenc, início">
            <span className={styles.brandMark} aria-hidden="true">
              L.
            </span>

            <span className={styles.brandName}>
              L&apos;Essenc
              <small>Digital</small>
            </span>
          </Link>

          <nav className={styles.nav} aria-label="Navegação da página">
            <a href="#metodo">Método</a>
            <a href="#conteudo-do-guia">Conteúdo</a>
            <a href="#oferta">Oferta</a>
            <a href="#faq">FAQ</a>
          </nav>

          <LinkAction href="#oferta" variant="outline" size="small">
            Ver a oferta
          </LinkAction>
        </Container>
      </header>

      <main id="conteudo">
        <Section className={styles.hero}>
          <Container size="wide" className={styles.heroGrid}>
            <Stack gap="large" className={styles.heroCopy}>
              <Stack gap="medium">
                <p className={styles.eyebrow}>Cronograma Capilar Inteligente</p>

                <h1>Pare de cuidar do seu cabelo no improviso.</h1>

                <p className={styles.lead}>
                  Entenda o que hidratação, nutrição e reconstrução fazem e organize esses cuidados
                  em uma rotina mais clara, consciente e fácil de acompanhar.
                </p>
              </Stack>

              <div className={styles.actions}>
                <LinkAction href="#metodo">Conhecer o método</LinkAction>
                <LinkAction href="#oferta" variant="ghost">
                  Ver a oferta
                </LinkAction>
              </div>

              <p className={styles.microcopy}>
                Um guia digital para transformar informação em uma rotina de cuidado mais
                organizada.
              </p>
            </Stack>

            <div className={styles.productVisual} aria-label="Cronograma Capilar Inteligente">
              <div className={styles.visualBackdrop} aria-hidden="true" />

              <div className={styles.book}>
                <div className={styles.bookTop}>
                  <span>L&apos;ESSENC</span>
                  <span>GUIA 01</span>
                </div>

                <div className={styles.bookCenter}>
                  <span className={styles.eyebrow}>Guia digital</span>
                  <strong>Cronograma Capilar Inteligente</strong>
                  <span className={styles.bookRule} aria-hidden="true" />
                  <p>Hidratação · Nutrição · Reconstrução</p>
                </div>

                <span className={styles.bookFooter}>Cuidado com intenção.</span>
              </div>
            </div>
          </Container>
        </Section>

        <Section tone="muted">
          <Container size="wide">
            <div className={styles.split}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>O problema</p>
                <h2>Produto demais. Critério de menos.</h2>
              </div>

              <Stack gap="medium" className={styles.bodyCopy}>
                <p>
                  É fácil acumular máscaras, receitas e recomendações diferentes sem entender qual
                  cuidado realmente faz sentido em cada momento.
                </p>
                <p>
                  O cronograma organiza o raciocínio antes da rotina: primeiro você entende a função
                  de cada etapa; depois passa a tomar decisões com mais clareza.
                </p>
              </Stack>
            </div>
          </Container>
        </Section>

        <Section id="metodo">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>O método</p>
                <h2>Três cuidados. Uma lógica simples.</h2>
                <p>
                  O método parte dos três pilares fundamentais do cronograma capilar e mostra como
                  cada um ocupa um papel diferente dentro da rotina.
                </p>
              </div>

              <Grid>
                <Surface padding="spacious" className={styles.pillar}>
                  <span className={styles.index}>01</span>
                  <h3>Hidratação</h3>
                  <p>
                    Reposição de água e suporte à maciez, flexibilidade e aparência saudável dos
                    fios.
                  </p>
                </Surface>

                <Surface padding="spacious" className={styles.pillar}>
                  <span className={styles.index}>02</span>
                  <h3>Nutrição</h3>
                  <p>
                    Reposição lipídica para ajudar na proteção da fibra, no brilho e no controle do
                    ressecamento.
                  </p>
                </Surface>

                <Surface padding="spacious" className={styles.pillar}>
                  <span className={styles.index}>03</span>
                  <h3>Reconstrução</h3>
                  <p>
                    Cuidado voltado à reposição de massa, aplicado com mais critério conforme a
                    necessidade.
                  </p>
                </Surface>
              </Grid>
            </Stack>
          </Container>
        </Section>

        <Section tone="muted">
          <Container size="wide">
            <div className={styles.benefitGrid}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Na prática</p>
                <h2>O objetivo é reduzir dúvida, não aumentar etapas.</h2>
              </div>

              <div className={styles.benefitList}>
                <div className={styles.benefit}>
                  <span>01</span>
                  <p>Entender a finalidade de cada tratamento.</p>
                </div>

                <div className={styles.benefit}>
                  <span>02</span>
                  <p>Organizar uma sequência de cuidados com lógica.</p>
                </div>

                <div className={styles.benefit}>
                  <span>03</span>
                  <p>Observar a resposta do cabelo ao longo da rotina.</p>
                </div>

                <div className={styles.benefit}>
                  <span>04</span>
                  <p>Evitar decisões baseadas apenas em excesso de informação.</p>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        <Section id="conteudo-do-guia">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>O que você recebe</p>
                <h2>Um guia para consultar, aplicar e acompanhar.</h2>
                <p>
                  O conteúdo foi pensado para explicar o método e ajudar você a organizar o
                  cronograma de forma prática.
                </p>
              </div>

              <Grid columns={2}>
                <Surface padding="spacious" className={styles.contentCard}>
                  <span className={styles.index}>A</span>
                  <h3>Fundamentos</h3>
                  <p>
                    Uma explicação clara sobre hidratação, nutrição e reconstrução e o papel de cada
                    etapa.
                  </p>
                </Surface>

                <Surface padding="spacious" className={styles.contentCard}>
                  <span className={styles.index}>B</span>
                  <h3>Organização</h3>
                  <p>
                    Uma estrutura para transformar os três pilares em uma rotina compreensível e
                    acompanhável.
                  </p>
                </Surface>
              </Grid>
            </Stack>
          </Container>
        </Section>

        <Section tone="muted">
          <Container size="wide">
            <div className={styles.split}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Como usar</p>
                <h2>Leia. Observe. Organize. Ajuste.</h2>
              </div>

              <div className={styles.steps}>
                <div className={styles.step}>
                  <span>01</span>
                  <div>
                    <strong>Entenda</strong>
                    <p>Comece pelo papel de cada etapa do cronograma.</p>
                  </div>
                </div>

                <div className={styles.step}>
                  <span>02</span>
                  <div>
                    <strong>Observe</strong>
                    <p>Considere o estado e a resposta atual dos fios.</p>
                  </div>
                </div>

                <div className={styles.step}>
                  <span>03</span>
                  <div>
                    <strong>Organize</strong>
                    <p>Estruture os cuidados de maneira simples e sustentável.</p>
                  </div>
                </div>

                <div className={styles.step}>
                  <span>04</span>
                  <div>
                    <strong>Ajuste</strong>
                    <p>Reavalie a rotina conforme o cabelo responde.</p>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        <Section>
          <Container size="wide">
            <div className={styles.split}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Para quem é</p>
                <h2>Para quem quer entender antes de simplesmente repetir.</h2>
              </div>

              <Stack gap="medium" className={styles.bodyCopy}>
                <p>
                  O guia é direcionado a quem deseja organizar melhor os cuidados capilares e
                  compreender por que cada etapa existe.
                </p>
                <p>
                  Ele não substitui avaliação profissional quando houver alterações importantes no
                  couro cabeludo, queda acentuada ou outras condições que precisem de diagnóstico.
                </p>
              </Stack>
            </div>
          </Container>
        </Section>

        <Section className={styles.productSection} tone="muted">
          <Container size="wide">
            <div className={styles.productPresentation}>
              <div className={styles.miniBook} aria-hidden="true">
                <span>L&apos;ESSENC</span>
                <strong>Cronograma Capilar Inteligente</strong>
                <small>Guia digital</small>
              </div>

              <Stack gap="medium">
                <p className={styles.eyebrow}>Produto digital</p>
                <h2>Conhecimento organizado para acompanhar sua rotina.</h2>
                <p className={styles.bodyCopy}>
                  Um material desenvolvido pela L&apos;Essenc para aproximar método, cuidado e
                  autonomia.
                </p>
              </Stack>
            </div>
          </Container>
        </Section>

        <Section id="oferta">
          <Container size="wide">
            <div className={styles.offerGrid}>
              <Stack gap="medium">
                <p className={styles.eyebrow}>Oferta</p>
                <h2>Conheça a condição atual do Cronograma Capilar Inteligente.</h2>
                <p className={styles.bodyCopy}>
                  As informações comerciais desta área são resolvidas no momento da visita a partir
                  da oferta oficial da L&apos;Essenc.
                </p>
              </Stack>

              <CommercialState experience={experience} />
            </div>
          </Container>
        </Section>

        <Section tone="muted">
          <Container size="wide">
            <div className={styles.split}>
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Sobre a compra</p>
                <h2>Informação antes da transação.</h2>
              </div>

              <Stack gap="medium" className={styles.bodyCopy}>
                <p>
                  Esta página apresenta o produto, o método e a condição comercial atual quando ela
                  estiver disponível.
                </p>
                <p>
                  Esta página não cria pedidos. Ao continuar para o checkout, um pedido pendente
                  poderá ser registrado; nenhum pagamento é processado nesta fase.
                </p>
              </Stack>
            </div>
          </Container>
        </Section>

        <Section id="faq">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Perguntas frequentes</p>
                <h2>Antes de começar.</h2>
              </div>

              <div className={styles.faq}>
                <details>
                  <summary>O cronograma é um produto físico?</summary>
                  <p>Não. O Cronograma Capilar Inteligente é apresentado como conteúdo digital.</p>
                </details>

                <details>
                  <summary>Preciso seguir uma rotina fixa para sempre?</summary>
                  <p>
                    Não. A proposta é compreender os cuidados e acompanhar a resposta do cabelo para
                    ajustar a organização quando necessário.
                  </p>
                </details>

                <details>
                  <summary>O conteúdo substitui uma avaliação profissional?</summary>
                  <p>
                    Não. Alterações relevantes no couro cabeludo, queda acentuada ou outras
                    condições devem ser avaliadas por um profissional habilitado.
                  </p>
                </details>

                <details>
                  <summary>Já posso realizar o pagamento nesta página?</summary>
                  <p>
                    Ainda não. O checkout já pode registrar um pedido pendente, mas o processamento
                    de pagamento será disponibilizado em uma etapa posterior.
                  </p>
                </details>
              </div>
            </Stack>
          </Container>
        </Section>

        <Section className={styles.finalSection} tone="muted">
          <Container size="narrow">
            <Stack gap="large" className={styles.finalContent}>
              <p className={styles.eyebrow}>L&apos;Essenc</p>
              <h2>Mais clareza para cuidar com intenção.</h2>
              <p>
                Releia o método, veja o conteúdo do guia ou consulte a condição atual da oferta.
              </p>

              <div className={styles.actions}>
                <LinkAction href="#metodo">Entender o método</LinkAction>
                <LinkAction href="#oferta" variant="ghost">
                  Ver a oferta
                </LinkAction>
              </div>
            </Stack>
          </Container>
        </Section>
      </main>

      <footer className={styles.footer}>
        <Container size="wide" className={styles.footerInner}>
          <Link href="/" className={styles.footerBrand}>
            L&apos;Essenc
          </Link>

          <p>Cuidado com intenção.</p>

          <Link href="/">Voltar ao início</Link>
        </Container>
      </footer>
    </>
  );
}
