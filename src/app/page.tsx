import Link from "next/link";

import { Container, Grid, Inline, Section, Stack } from "@/components/layout/layout";
import { Button, LinkAction } from "@/components/ui/button";
import { Alert, Badge, StatePanel } from "@/components/ui/feedback";
import { TextField } from "@/components/ui/field";
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
          <Link href="/" className={styles.brand} aria-label="L'Essenc Digital, início">
            <span className={styles.brandMark} aria-hidden="true">
              L.
            </span>
            <span className={styles.brandName}>
              L&apos;Essenc <small>Digital</small>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="Navegação da prévia">
            <a href="#fundamentos">Fundamentos</a>
            <a href="#componentes">Componentes</a>
            <a href="#feedback">Estados</a>
          </nav>
          <Badge tone="information">Prévia P05</Badge>
        </Container>
      </header>

      <main id="conteudo">
        <Section className={styles.hero}>
          <Container size="wide" className={styles.heroGrid}>
            <Stack gap="large" className={styles.heroCopy}>
              <Stack gap="medium">
                <p className={styles.eyebrow}>Fundação visual · L&apos;Essenc Digital</p>
                <h1>Clareza em cada detalhe.</h1>
                <p className={styles.lead}>
                  Uma prévia técnica do sistema de interface que dará consistência às próximas
                  jornadas digitais. Esta página ainda não é uma oferta ou uma experiência de
                  compra.
                </p>
              </Stack>
              <Inline>
                <LinkAction href="#componentes">Explorar componentes</LinkAction>
                <LinkAction href="#fundamentos" variant="ghost">
                  Ver fundamentos
                </LinkAction>
              </Inline>
            </Stack>

            <Surface elevation="raised" padding="spacious" className={styles.heroPanel}>
              <Stack gap="large">
                <Inline gap="small" className={styles.panelTop}>
                  <span className={styles.panelDot} aria-hidden="true" />
                  <span>Design foundation / 05</span>
                </Inline>
                <div className={styles.panelMessage}>
                  <p className={styles.panelKicker}>Uma linguagem comum</p>
                  <p>Tipografia, espaço e interação trabalhando juntos.</p>
                </div>
                <div className={styles.panelRule} aria-hidden="true" />
                <Inline gap="small">
                  <Badge tone="success">Legível</Badge>
                  <Badge tone="neutral">Responsivo</Badge>
                  <Badge tone="information">Reutilizável</Badge>
                </Inline>
              </Stack>
            </Surface>
          </Container>
        </Section>

        <Section id="fundamentos" tone="muted">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>01 / Fundamentos</p>
                <h2>O essencial, organizado.</h2>
                <p>
                  Tokens semânticos mantêm a mesma hierarquia visual em telas pequenas, médias e
                  amplas.
                </p>
              </div>
              <Grid>
                <Surface className={styles.foundationCard}>
                  <Stack>
                    <span className={styles.cardIndex}>01 — Cor</span>
                    <h3>Função antes de decoração.</h3>
                    <p>Superfícies, texto e estados têm papéis definidos e combinações legíveis.</p>
                    <div
                      className={styles.swatches}
                      role="img"
                      aria-label="Amostras das cores primária, secundária, destaque e informação"
                    >
                      <span className={styles.swatchPrimary} aria-hidden="true" />
                      <span className={styles.swatchSecondary} aria-hidden="true" />
                      <span className={styles.swatchAccent} aria-hidden="true" />
                      <span className={styles.swatchInformation} aria-hidden="true" />
                    </div>
                  </Stack>
                </Surface>
                <Surface className={styles.foundationCard}>
                  <Stack>
                    <span className={styles.cardIndex}>02 — Tipo</span>
                    <h3>Ritmo de leitura.</h3>
                    <p>Uma família de sistema para leitura e uma serifada local para títulos.</p>
                    <span className={styles.typeSample}>Aa Bb Cc</span>
                  </Stack>
                </Surface>
                <Surface className={styles.foundationCard}>
                  <Stack>
                    <span className={styles.cardIndex}>03 — Espaço</span>
                    <h3>Respiro consistente.</h3>
                    <p>Escalas compartilhadas orientam distância, largura e densidade.</p>
                    <div className={styles.spaceSample} aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  </Stack>
                </Surface>
              </Grid>
            </Stack>
          </Container>
        </Section>

        <Section id="componentes">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>02 / Componentes</p>
                <h2>Peças simples, comportamento claro.</h2>
                <p>Esta vitrine demonstra aparência e semântica; não executa ações de produto.</p>
              </div>
              <Grid columns={2}>
                <Surface padding="spacious">
                  <Stack gap="large">
                    <Stack gap="small">
                      <p className={styles.cardIndex}>Ações</p>
                      <h3 className={styles.componentHeading}>Variantes com o mesmo ritmo.</h3>
                    </Stack>
                    <Inline>
                      <LinkAction href="#formulario">Primária</LinkAction>
                      <LinkAction href="#feedback" variant="secondary">
                        Secundária
                      </LinkAction>
                      <LinkAction href="#fundamentos" variant="outline">
                        Contorno
                      </LinkAction>
                    </Inline>
                    <Inline>
                      <Button type="button" disabled>
                        Indisponível
                      </Button>
                      <Button type="button" loading loadingLabel="Carregando…">
                        Aguardar
                      </Button>
                    </Inline>
                  </Stack>
                </Surface>
                <Surface id="formulario" padding="spacious">
                  <Stack gap="large">
                    <Stack gap="small">
                      <p className={styles.cardIndex}>Formulários</p>
                      <h3 className={styles.componentHeading}>
                        Rótulo e retorno próximos do campo.
                      </h3>
                    </Stack>
                    <TextField
                      id="preview-reference"
                      label="Nome de referência"
                      placeholder="Digite um nome"
                      helperText="Exemplo de campo sem envio de dados."
                    />
                    <TextField
                      id="preview-error"
                      label="Exemplo de erro"
                      type="email"
                      placeholder="nome@exemplo.com"
                      error="Informe um endereço válido."
                    />
                  </Stack>
                </Surface>
              </Grid>
            </Stack>
          </Container>
        </Section>

        <Section id="feedback" tone="muted">
          <Container size="wide">
            <Stack gap="large">
              <div className={styles.sectionHeading}>
                <p className={styles.eyebrow}>03 / Estados</p>
                <h2>Feedback que explica o próximo passo.</h2>
                <p>Texto e semântica acompanham a cor em mensagens, erros e estados vazios.</p>
              </div>
              <Grid columns={2}>
                <Stack>
                  <Alert heading="Informação de interface">
                    Este exemplo mostra uma mensagem informativa sem depender apenas da cor.
                  </Alert>
                  <Alert tone="warning" heading="Atenção ao preenchimento">
                    As instruções e os erros devem aparecer junto ao controle relevante.
                  </Alert>
                  <Inline gap="small">
                    <Badge tone="success">Disponível</Badge>
                    <Badge tone="warning">Atenção</Badge>
                    <Badge tone="danger">Erro</Badge>
                  </Inline>
                </Stack>
                <Stack>
                  <StatePanel
                    kind="empty"
                    title="Nenhum item por enquanto"
                    description="Um estado vazio explica o contexto antes de oferecer uma ação."
                  />
                  <StatePanel
                    kind="error"
                    title="Não foi possível carregar"
                    description="Uma mensagem de erro descreve o problema e orienta a recuperação."
                  />
                </Stack>
              </Grid>
            </Stack>
          </Container>
        </Section>
      </main>

      <footer className={styles.footer}>
        <Container size="wide" className={styles.footerInner}>
          <span>L&apos;Essenc Digital · Fundação de interface P05</span>
          <span>Prévia técnica, sem oferta ativa nesta página.</span>
        </Container>
      </footer>
    </>
  );
}
