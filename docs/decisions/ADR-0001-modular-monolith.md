# ADR-0001 — Modular Monolith

**Status:** ACCEPTED — baseline documental P02, 11/09/2026.

**Decisão:** monólito modular com camadas Presentation, Application, Domain e Infrastructure e limites explícitos de Catalog, Customers, Commerce, Payments, Entitlements, Fulfillment, Notifications, Attribution, Administration e Audit. Persistência compartilhada não dá a Payments permissão para UPDATE direto em Entitlements; coordenação usa serviços e transação local. Evita microservices, Kafka ou RabbitMQ sem necessidade demonstrada.

**Consequência:** menos infraestrutura inicial e responsabilidades testáveis por módulo. [Detalhes](../architecture/module-boundaries.md). Sem alteração física nesta sessão.
