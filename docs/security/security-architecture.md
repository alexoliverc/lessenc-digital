# P02 — Arquitetura de segurança LES-DIG

**Status:** baseline documental COMPLETE; implementação PENDING. Referência histórica detalhada: [LES-SEC-DIG-R01](../architecture/LES-SEC-DIG-R01.md), quando compatível com P00–P04.

Invariantes: browser nunca aprova pagamento; sem download sem `Entitlement.ACTIVE`; admin exige autenticação e autorização server-side; sem secrets no Git; sem dados brutos de cartão; ativos pagos privados; webhook com assinatura inválida não altera estado financeiro; URL assinada de download é segredo temporário, individual e revogável conforme política.

Defesa em profundidade: HTTPS, CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSRF em operação autenticada por cookie, CORS restrito, prevenção de XSS/injection/IDOR/BOLA, rate limiting crítico, cookies seguros, validação de entrada, scanner de segredos e dependências, autenticação de webhooks e jobs internos. Não tratar visibilidade do botão como autorização. Proteção de dados por minimização e segregação de ambientes.

Painel: identidade individual, autenticação forte, MFA, sessões seguras, autorização e auditoria; tecnologia/provedor de autenticação: **OPEN**. Fornecedor de rate limit distribuído de produção: **OPEN**. Meta histórica ASVS Level 2 é objetivo de verificação, não declaração de conformidade.
