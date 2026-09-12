# P05 — Fundação de componentes

**Código:** [`src/components/layout/`](../../src/components/layout/) e [`src/components/ui/`](../../src/components/ui/). Todos os componentes aceitam `className` e atributos nativos pertinentes; variantes são tipadas, sem dependência de produto, pagamento ou autenticação.

| Componente | Contrato principal | Semântica e estados |
| --- | --- | --- |
| `Container` | `size: narrow / standard / wide` | Limita largura e aplica gutter fluido; `div` neutro |
| `Section` | `tone: base / muted` | Usa `section`; a tela deve fornecer título identificável |
| `Stack` e `Inline` | `gap: small / medium / large`; `Inline.align` | Fluxo vertical ou horizontal com wrap |
| `Grid` | `columns: 2 / 3` | Uma coluna no mobile, duas no tablet e até três no desktop |
| `Button` | `variant`, `size`, `loading`, `loadingLabel` | `button` nativo; loading mostra texto, `aria-busy` e `disabled` |
| `LinkAction` | `href`, `variant`, `size` | Âncora nativa para navegação; não simula botão desabilitado |
| `TextField` | `id`, `label`, `helperText`, `error`, props nativas de input | `<label>` associado, `aria-describedby`, `aria-invalid`, erro com `role=alert` |
| `Alert` | `tone`, `heading`, conteúdo | Mensagem textual; `role=status` ou `role=alert` para perigo |
| `Badge` | `tone`, conteúdo | Estado sempre escrito, nunca indicado apenas por cor |
| `StatePanel` | `kind: empty / error`, título e descrição | `section` nomeada; erro com `role=alert` |
| `Surface` | `elevation`, `padding` | Contêiner visual sem semântica interativa inventada |

Variantes de ação: `primary`, `secondary`, `outline`, `ghost` e `destructive` no botão; links não possuem variante destrutiva. Hover, active, focus-visible e disabled são definidos no CSS. O botão de carregamento preserva um nome textual visível; o indicador giratório é decorativo e deixa de animar com preferência de movimento reduzido.

`TextField` exige `id` estável e único na página. O erro não valida dados sozinho: a camada de aplicação futura deve fornecer a mensagem e a validação correta. Textarea, select, diálogos, menu, navegação de app, tabelas e componentes de checkout/admin serão criados somente quando houver casos reais e brief das fases correspondentes. Não foi adicionada biblioteca de interação para simular esses casos agora.
