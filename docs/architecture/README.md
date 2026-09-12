# Arquitetura técnica — LES-DIG P02, P03 e P04

Consulte o [índice completo](../README.md). Documentos atuais: arquitetura do [sistema](system-architecture.md), [limites de módulos](module-boundaries.md), [integrações](integrations-architecture.md), [deploy](deployment-architecture.md), [domínio P03](domain-model.md), [revisão P03](p03-exit-review.md), [toolchain P04](runtime-toolchain-baseline.md) e [revisão P04](p04-exit-review.md), com documentos especializados ligados por esses arquivos.

`LES-*-R01.md` foram aprovados na sequência MVP anterior e permanecem preservados como evidência histórica. A nova baseline LES-DIG substitui onde divergir: produto, estados, conjunto de módulos, outbox, `npm` e quarto ambiente. A reconciliação física P04 passou nas validações locais e aguarda revisão técnica; Node.js/npm do host permanecem abaixo do target. MySQL + Prisma permanecem decisões arquiteturais aceitas, mas sua implementação física foi atribuída à P06 — Data & Persistence Foundation.
