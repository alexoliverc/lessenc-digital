# P04 — Baseline de segurança da aplicação

**Status:** specification COMPLETE; controles específicos implementados apenas quando demonstrados por testes futuros.

Requisitos por superfície: checkout valida entrada e preço no backend; PaymentProvider não expõe segredo; webhook exige assinatura válida, idempotência, consulta e transição permitida; worker da outbox autentica sua origem e rejeita efeitos duplicados; rotas de asset verificam identidade/propriedade, direito ativo e asset válido; downloads usam tokens/URLs temporários tratados como segredos; admin exige MFA, sessão segura e autorização por ação com auditoria.

Cabeçalhos e controles a validar em ambiente real: HTTPS/HSTS, CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, CSRF, CORS, XSS, rate limiting, secure cookies, varredura de segredos/dependências. Testes críticos: webhook forjado não altera estado; acesso sem direito ativo é negado; evento antigo não regride pagamento; operador sem role apropriada recebe acesso negado. Não registrar PAN, CVV, senhas, session IDs ou links de download completos em logs.

Provedores de autenticação, email, storage, observabilidade e rate limit distribuído: **OPEN**. Nenhum secret foi fornecido ou criado por esta especificação.
