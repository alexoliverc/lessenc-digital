# P05 — Design System & UX Foundation

**Estado:** COMPLETE — implementação validada e ChatGPT Technical Review PASS em 12/09/2026.

Esta fundação estabelece linguagem visual, layout responsivo e componentes de interface reutilizáveis para as futuras superfícies públicas e administrativas da L'Essenc Digital. A página `/` é uma prévia técnica, sem oferta comercial, checkout ou ação de produto.

## Fontes da implementação

- [Tokens](design-tokens.md): papéis de cor, tipografia, espaço, tamanhos, forma e movimento; valores em [`src/styles/tokens.css`](../../src/styles/tokens.css).
- [Componentes](component-foundation.md): layout, ações, campo, feedback e superfície; código em [`src/components/`](../../src/components/).
- [Responsividade e acessibilidade](responsive-accessibility.md): larguras, semântica, foco, contraste e revisão visual.
- [Exit review](p05-exit-review.md): evidências da fase e limites pendentes.

## Política de extensão

Novas telas devem compor as primitivas existentes e usar tokens semânticos. Um novo token deve representar uma decisão reutilizável; um novo componente deve eliminar repetição real ou assegurar comportamento acessível consistente. CSS específico da tela permanece junto à tela, sem migrar detalhes comerciais para primitivas genéricas. Não introduzir biblioteca visual, ícones externos, fontes remotas ou client components sem necessidade e autorização aplicável.

P05 não implementa schema, persistência, pagamentos, autenticação, entrega, analytics, deploy, página de vendas final nem Gate A. Esses trabalhos pertencem às respectivas fases e briefs.
