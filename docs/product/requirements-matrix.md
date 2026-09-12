# P01 — Matriz de requisitos da L'Essenc Digital

**Status:** baseline documental COMPLETE. Evidência de implementação deve ser adicionada em fases futuras, sem transformar especificação em teste já passado.

| ID | Requisito verificável | Fonte | Estado físico |
| --- | --- | --- | --- |
| P01-01 | Oferta do Cronograma Capilar Inteligente por R$ 29,90, 2990 BRL | [produto](first-product-definition.md) | PENDING |
| P01-02 | Venda única, BRL/Brasil, quantidade 1, PIX/cartão | [regras](offer-commercial-rules.md) | PENDING |
| P01-03 | Checkout sem conta prévia obrigatória; entrada validada no servidor | [jornada](customer-journey-business-rules.md) | PENDING |
| P01-04 | Pedido e tentativa interna criados antes da cobrança externa | [integrações](../architecture/integrations-architecture.md) | PENDING |
| P01-05 | Nenhuma prova de pagamento proveniente do navegador | [segurança](../security/security-architecture.md) | PENDING |
| P01-06 | Pagamento confirmado gera acesso idempotente e ativo | [modelo](../architecture/domain-model.md) | PENDING |
| P01-07 | Ativos pagos privados e URLs de acesso temporário protegidas | [segurança](../security/application-security-baseline.md) | PENDING |
| P01-08 | Notificação/fulfillment falhos não fazem downgrade financeiro | [outbox](../architecture/refund-notification-outbox-models.md) | PENDING |
| P01-09 | Admin exige MFA, autorização e auditoria | [segurança](../security/security-architecture.md) | PENDING |
| P01-10 | Métrica comercial distinta de evento financeiro | [observabilidade](../architecture/logging-errors-observability-foundation.md) | PENDING |
