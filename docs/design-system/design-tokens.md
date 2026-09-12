# P05 — Tokens visuais

**Fonte executável:** [`src/styles/tokens.css`](../../src/styles/tokens.css), importado por `src/app/globals.css`. Os componentes consomem variáveis CSS; valores de cor não são duplicados nas folhas de componentes.

## Cor semântica

| Papel | Tokens principais | Uso |
| --- | --- | --- |
| Base | `background`, `surface`, `surface-raised`, `surface-muted` | Página e camadas de conteúdo |
| Texto | `foreground`, `foreground-muted` | Leitura principal e secundária |
| Limites | `border`, `border-soft` | Controles e separações decorativas |
| Ação | `primary`, `secondary`, respectivos `*-foreground`, hover e active | Botões e links de ação |
| Ênfase | `accent` | Rótulos e destaque editorial, sem substituir estados |
| Estado | `success`, `warning`, `danger`, `information` e superfícies correspondentes | Mensagem com texto explícito |
| Teclado | `focus` | Anel de foco de 3 px, visível fora do controle |
| Inativo | `disabled-surface`, `disabled-foreground` | Controle indisponível com estado nativo `disabled` |

A paleta clara utiliza fundo marfim, texto castanho profundo e acentos contidos. Não há modo escuro nesta fase. Os papéis permitem uma futura camada temática sem alterar a API dos componentes.

Contrastes calculados para pares efetivamente usados: texto principal/fundo **14,89:1**; texto secundário/superfície **7,25:1**; ação primária **12,41:1**; texto de destaque/superfície **6,43:1**; borda de controle/superfície **4,27:1**; anel de foco/superfície **6,96:1**. As mensagens de estado ficam entre **6,07:1 e 7,31:1** para texto/superfície correspondente. A referência de projeto é o [WCAG 2.2 do W3C](https://www.w3.org/TR/WCAG22/): 4,5:1 para texto comum e 3:1 para componentes visuais relevantes. Esses números não dispensam inspeção visual das telas finais.

## Tipo, espaço e dimensão

- Família de sistema para corpo, rótulos, legendas e ações; Georgia local para títulos. Nenhum download de fonte.
- Hierarquia: `display`, `title`, `heading`, `subheading`, `body`, `small`, `caption`, `label`, `action`. Tamanhos de destaque usam `clamp()` para não depender de uma largura única.
- Escala de espaçamento `space-1` a `space-9`; larguras `content-narrow`, `content-standard`, `content-wide` e `form-width`; gutter fluido em `page-gutter`.
- Alturas mínimas de controle: 3 rem regular e 2,5 rem pequeno. Radius `sm`, `md`, `lg` e `pill`; sombras discretas `soft` e `raised`.
- Movimento usa `duration-fast`/`duration-normal`; `prefers-reduced-motion: reduce` remove transições e animações não essenciais. Nenhuma informação depende de movimento.

Os media queries em `layout.module.css` usam `42rem` e `64rem`; CSS não usa variáveis customizadas como condição de `@media`. A largura máxima ampla é 84 rem. Z-index não ganhou escala porque a fundação só usa um skip link acima do conteúdo e não possui overlays.
