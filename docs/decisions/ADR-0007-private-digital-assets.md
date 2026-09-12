# ADR-0007 — Ativos digitais privados

**Status:** ACCEPTED — baseline documental P02, 11/09/2026.

**Decisão:** ebook pago nunca fica em `/public/` nem tem URL permanente acessível. Request exige autorização server-side, `Entitlement.ACTIVE`, validação do asset e acesso temporário seguro. URLs assinadas são segredos e devem ser protegidas de logs e analytics.

**Consequência:** storage e política de expiração/reemissão precisam de escolha futura **OPEN** e testes de acesso indevido. [Segurança](../security/security-architecture.md).
