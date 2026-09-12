# P03 — Modelo relacional e restrições

**Status:** especificação COMPLETE; schema/migrations PENDING.

Separar `Order` de `OrderItem`, `Payment` de `PaymentAttempt` e `PaymentEvent`, e ambos de `Entitlement`. Acesso vinculado ao item da compra, não apenas ao email. Registros de preço/moeda usam integer minor units e código de moeda, preservando snapshot da oferta. Banco inicial MySQL, timestamps UTC, histórico financeiro e auditoria sem exclusão física rotineira.

Restrições aprovadas: `Entitlement.orderItemId UNIQUE`, `PaymentEvent(provider, providerEventId) UNIQUE`, `OutboxEvent.deduplicationKey UNIQUE`. Referências externas do provedor são distintas dos IDs internos. `Customer.email` **não é globalmente UNIQUE** no MVP; índice/busca não impõe identidade única. Unicidade de provedor/tentativa, FKs, cascatas, limites de tamanho e índices físicos adicionais requerem desenho Prisma detalhado no brief. A deduplicação por evento, item e chave protege concorrência; transação coordenada impede estado pago sem registro recuperável de direito e outbox.
