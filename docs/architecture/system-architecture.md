# P02 — Arquitetura do sistema LES-DIG

**Status:** especificação COMPLETE; implementação PENDING.

A plataforma é um **monólito modular** próprio sobre Next.js, React, TypeScript, Node.js, MySQL e Prisma. Camadas: `Presentation → Application → Domain → Infrastructure`. Página e APIs nunca se tornam autoridade de preço, pagamento, autorização ou entrega; essas decisões são verificadas no servidor. Hostinger hospeda a aplicação gerenciada inicialmente; Mercado Pago fica por trás de `PaymentProvider`.

`src/app/` expõe apresentação, `src/modules/` mantém domínio e aplicação por módulo, `src/infrastructure/` contém adapters, `src/shared/` apenas primitivas realmente transversais e `src/config/` a configuração validada. Manter TypeScript estrito; chamadas entre módulos passam por operações explícitas, não por updates diretos nas tabelas de outro domínio. [Fronteiras](module-boundaries.md) e [integrações](integrations-architecture.md) detalham o contrato.

Invariantes: browser não aprova pagamento; webhooks não autenticados não alteram estado; `Payment.APPROVED → Order.PAID → Entitlement.ACTIVE` em operação consistente; ativos pagos são privados; side effects assíncronos usam [outbox transacional](refund-notification-outbox-models.md); falha de e-mail ou fulfillment não desfaz o pagamento. Não iniciar com microsserviços, Kubernetes, Kafka ou RabbitMQ sem evidência e decisão formal.
