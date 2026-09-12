# ROADMAP — LES-DIG

**Baseline documental:** 11/09/2026. **Próxima fase de documentação:** P05 — Design System.

| Fase | Tema | Documentação | Implementação física |
| --- | --- | --- | --- |
| P00 | Foundation & Governance | COMPLETE | Governança inicial existente |
| P01 | Product Requirements | COMPLETE | DEFERRED |
| P02 | Architecture | COMPLETE | DEFERRED |
| P03 | Database & Domain Model | COMPLETE | PENDING: sem Prisma, banco, schema ou migrations |
| P04 | Application Foundation | Specification COMPLETE | PENDING: baseline física P04 não executada |
| P05 | Design System | NEXT: documentação | PENDING |
| P06 | Sales Page | PENDING | PENDING |
| P07 | Product Engine | PENDING | PENDING |
| P08 | Admin Authentication | PENDING | PENDING |
| P09 | Admin Panel | PENDING | PENDING |
| P10 | Checkout Engine | PENDING | PENDING |
| P11 | Mercado Pago Integration | PENDING | PENDING |
| P12 | Payment Webhooks | PENDING | PENDING |
| P13 | Order Engine | PENDING | PENDING |
| P14 | Digital Delivery | PENDING | PENDING |
| P15 | Customer Communication | PENDING | PENDING |
| P16 | Analytics & Attribution | PENDING | PENDING |
| P17 | Security Hardening | PENDING | PENDING |
| P18 | LGPD & Legal Surface | PENDING | PENDING |
| P19 | Observability & Backup | PENDING | PENDING |
| P20 | Automated Test Suite | PENDING | PENDING |
| P21 | Performance & SEO | PENDING | PENDING |
| P22 | Staging | PENDING | PENDING |
| P23 | Production Deployment | PENDING | PENDING |
| P24 | Launch Readiness | PENDING | PENDING |
| P25 | Launch | PENDING | PENDING |
| P26 | CRO & Growth Engine | PENDING | PENDING |

O código legado no commit local `4507a27` contém um scaffold funcional com `pnpm` e outras versões. Ele é evidência de uma etapa anterior denominada `MVP-IMPL-01`, **não** evidência de implantação física da especificação P04 com npm/Prisma. A adoção física da nova baseline requer brief, aprovação de gates e migração explícita e reversível; esta consolidação não inicia tal migração.

O [roadmap anterior](docs/LES-ROADMAP-DIG-R01.md) preserva a cronologia `GOV/MVP-*`, agora histórica quanto à sequência futura, produto e escolhas substituídas pela missão P00–P04. Para estado e próxima fase, prevalece este arquivo; para requisitos detalhados, seguir o [índice da baseline](docs/README.md). Uma fase documentada não autoriza implementação, commit remoto, merge ou deploy. Para cada execução aplicar o Phase Execution Brief e os gates de [AGENTS.md](AGENTS.md).
