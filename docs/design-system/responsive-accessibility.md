# P05 — Responsividade e acessibilidade

## Composição móvel primeiro

`Container` usa largura fluida e gutter de `1rem` até `3rem`. `Grid` inicia em uma coluna, passa a duas em `42rem` (tablet) e pode chegar a três em `64rem` (desktop); `columns=2` permanece em duas. `Inline` permite quebra de linha. O conteúdo amplo para em `84rem` e a tipografia principal usa `clamp()`. A prévia `/` mantém navegação visível e quebra de linha no mobile, sem esconder ações atrás de menu não implementado.

Faixas de revisão: mobile compacto, mobile comum, tablet, desktop e desktop amplo. Os pontos de quebra seguem o espaço necessário ao conteúdo, não modelos específicos de aparelho. Componentes devem continuar úteis com zoom, texto maior e labels mais longos.

## Contrato de acessibilidade

- A página oferece skip link para `<main>`, cabeçalho, navegação nomeada, seções com títulos e ordem de headings.
- Botões são `<button>`, links são `<a>`, inputs têm `<label>` associado. `disabled`, `required`, `aria-busy`, `aria-invalid` e `aria-describedby` acompanham os estados relevantes.
- Erros e alertas usam texto, sem comunicação só por cor. `role=alert` é reservado a erro/perigo; mensagens não urgentes usam `role=status`.
- `:focus-visible` aplica anel de 3 px com contraste calculado de 6,96:1 sobre superfície clara. Nenhum estilo remove o foco sem substituição.
- Controles regulares têm altura mínima de 48 px. O controle pequeno de 40 px deve ser reservado a contextos com espaço suficiente e revisto nas telas finais.
- Movimento é discreto e desligado para `prefers-reduced-motion: reduce`; o estado de carregamento permanece textual quando o spinner para.
- A referência de contraste é o [WCAG 2.2](https://www.w3.org/TR/WCAG22/) do W3C; pares de tokens e medidas constam em [design-tokens.md](design-tokens.md).

P05 valida a fundação, não certifica telas futuras. A prévia foi conferida no Chrome headless em 320, 390, 768, 1440 e 1920 px sem rolagem horizontal, com capturas mobile e desktop inspecionadas. Cada fase de produto deverá revisar navegação por teclado, foco, zoom/reflow, leitores de tela, mensagens de erro e contraste no contexto real.
