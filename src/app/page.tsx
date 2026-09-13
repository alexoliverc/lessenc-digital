import Link from "next/link";

import { Container, Grid, Section, Stack } from "@/components/layout/layout";
import { LinkAction } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

import styles from "./page.module.css";

export default function HomePage() {
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

          <nav className={styles.nav} aria-label="Navegação principal">
            <a href="#essencia">Essência</a>
            <a href="#produto">Cronograma</a>
            <a href="#metodo">Método</a>
          </nav>

          <LinkAction href="/cronograma-capilar-inteligente" variant="outline" size="small">
            Conhecer o cronograma
          </LinkAction>
        </Container>
      </header>

      <main id="conteudo">
        <Section className={styles.hero}>
          <Container size="wide" className={styles.heroGrid}>
            <Stack gap="large" className={styles.heroCopy}>
              <Stack gap="medium">
                <p className={styles.eyebrow}>L&apos;Essenc · cuidado com intenção</p>

                <h1>Seu cabelo não precisa de mais improviso.</h1>

                <p className={styles.lead}>
                  A L&apos;Essenc transforma cuidado capilar em método: mais clareza para entender o
                  que o seu cabelo precisa e mais consistência para construir uma rotina que faça
                  sentido.
                </p>
              </Stack>

              <div className={styles.heroActions}>
                <LinkAction href="/cronograma-capilar-inteligente">
                  Conhecer o cronograma
                </LinkAction>

                <LinkAction href="#metodo" variant="ghost">
                  Entender o método
                </LinkAction>
              </div>

              <p className={styles.heroNote}>
                Conteúdo digital desenvolvido para organizar hidratação, nutrição e reconstrução sem
                complicar sua rotina.
              </p>
            </Stack>

            <div className={styles.heroVisual} aria-label="Apresentação editorial da L'Essenc">
              <div className={styles.visualGlow} aria-hidden="true" />

              <div className={styles.editorialCard}>
                <div className={styles.editorialTop}>
                  <span>L&apos;ESSENC</span>
                  <span>01</span>
                </div>

                <div className={styles.editorialCenter}>
                  <span className={styles.editorialLabel}>Guia digital</span>
                  <strong>Cronograma Capilar Inteligente</strong>
                  <span className={styles.editorialRule} aria-hidden="true" />
                  <p>Hidratação · Nutrição · Reconstrução</p>
                </div>

                <div className={styles.editorialBottom}>
                  <span>Cuidado com intenção.</span>
                </div>
              </div>

              <div className={styles.visualCaption}>
                <span>01</span>
                <p>Um método para transformar cuidado em rotina.</p>
              </div>
            </div>
          </Container>
        </Section>

        <Section id="essencia" tone="muted">
          <Container size="wide">
            <div className={styles.splitSection}>
              <div className={styles.sectionIntro}>
                <p className={styles.eyebrow}>Nossa essência</p>
                <h2>Menos excesso. Mais entendimento.</h2>
              </div>

              <Stack gap="medium" className={styles.sectionCopy}>
                <p>
                  Cuidar bem do cabelo não começa com uma prateleira cheia. Começa entendendo a
                  função de cada cuidado e quando ele realmente faz sentido.
                </p>

                <p>
                  A L&apos;Essenc nasce para organizar informação, método e experiência em uma
                  linguagem simples, refinada e aplicável à vida real.
                </p>
              </Stack>
            </div>
          </Container>
        </Section>

        <Section id="produto">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>Primeiro produto digital</p>
                <h2>Cronograma Capilar Inteligente</h2>
                <p>
                  Uma estrutura prática para você compreender e organizar os três pilares
                  fundamentais do cuidado capilar.
                </p>
              </div>

              <Grid>
                <Surface padding="spacious" className={styles.pillarCard}>
                  <span className={styles.cardIndex}>01</span>
                  <h3>Hidratação</h3>
                  <p>
                    Entenda o papel da reposição de água e como reconhecer quando o cabelo pede mais
                    maciez e flexibilidade.
                  </p>
                </Surface>

                <Surface padding="spacious" className={styles.pillarCard}>
                  <span className={styles.cardIndex}>02</span>
                  <h3>Nutrição</h3>
                  <p>
                    Organize o cuidado responsável pela reposição lipídica, brilho e proteção da
                    fibra.
                  </p>
                </Surface>

                <Surface padding="spacious" className={styles.pillarCard}>
                  <span className={styles.cardIndex}>03</span>
                  <h3>Reconstrução</h3>
                  <p>
                    Aprenda onde a reposição de massa se encaixa e por que ela exige mais critério
                    do que frequência.
                  </p>
                </Surface>
              </Grid>
            </Stack>
          </Container>
        </Section>

        <Section id="metodo" tone="muted">
          <Container size="wide">
            <div className={styles.methodGrid}>
              <Stack gap="large">
                <div className={styles.sectionHeading}>
                  <p className={styles.eyebrow}>O método</p>
                  <h2>Uma rotina que começa pelo entendimento.</h2>
                </div>

                <p className={styles.methodLead}>
                  O objetivo não é fazer mais etapas. É tomar decisões melhores sobre o cuidado.
                </p>

                <LinkAction href="/cronograma-capilar-inteligente">Ver como funciona</LinkAction>
              </Stack>

              <div className={styles.methodSteps}>
                <div className={styles.methodStep}>
                  <span>01</span>
                  <div>
                    <strong>Observe</strong>
                    <p>Entenda sinais, textura e necessidades do cabelo.</p>
                  </div>
                </div>

                <div className={styles.methodStep}>
                  <span>02</span>
                  <div>
                    <strong>Organize</strong>
                    <p>Distribua os cuidados de maneira clara e consciente.</p>
                  </div>
                </div>

                <div className={styles.methodStep}>
                  <span>03</span>
                  <div>
                    <strong>Acompanhe</strong>
                    <p>Ajuste a rotina conforme a resposta do seu cabelo.</p>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        <Section className={styles.finalSection}>
          <Container size="narrow">
            <Stack gap="large" className={styles.finalContent}>
              <p className={styles.eyebrow}>Comece com clareza</p>

              <h2>Transforme cuidado em intenção.</h2>

              <p>
                Conheça o Cronograma Capilar Inteligente e veja como a L&apos;Essenc organiza uma
                rotina capilar de forma simples, prática e consciente.
              </p>

              <div>
                <LinkAction href="/cronograma-capilar-inteligente">Conhecer os detalhes</LinkAction>
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

          <span>© L&apos;Essenc Digital</span>
        </Container>
      </footer>
    </>
  );
}
