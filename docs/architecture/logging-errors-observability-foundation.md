# P04 — Fundação de logs, erros e observabilidade

**Status:** specification COMPLETE; scaffold físico existente tem somente logger/health iniciais.

Separar **Technical Logs**, **AuditLog** e **Analytics**. Logs de produção preferem JSON estruturado com `event`, `correlationId`, IDs internos seguros, duração e código de erro. Proibir segredos, tokens de cartão, senhas, credenciais MySQL, URLs assinadas completas e dados pessoais desnecessários. `ApplicationError` distingue erro esperado de falha não tratada, sem expor detalhes internos ao usuário.

Health público mínimo não expõe dependências sensíveis; readiness interno futuro avalia componentes essenciais. Eventos financeiros, webhook, entitlement, outbox, notificações e fulfillment devem ser rastreáveis; erros críticos geram sinais acionáveis. O logger e `GET /api/health` atuais são evidência limitada do commit `4507a27`, não comprovação de toda a observabilidade P04. Provedor de observabilidade: **OPEN**. Ver [modelo histórico detalhado](LES-OBS-DIG-R01.md) onde não contradiga P04.
