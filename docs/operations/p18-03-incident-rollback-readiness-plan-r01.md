# LES-P18-03 — Incident, Rollback & Launch Readiness Plan R01

**Estado:** `DOCUMENTARY PLAN / NOT EXECUTED`

**Baseline Git:** `659684121a0e55bdb37192e29100999f1533912d`

## 1. Fronteira de autoridade

Este documento organiza preparação operacional futura; não é um runbook autorizado
para produção, nem inicia P19-A03. O owner mantém a decisão de lançamento.
Os executores, contatos de escalonamento, janelas e SLOs produtivos não estão
definidos por esta revisão e não são presumidos.

## 2. Caminho de detecção e resposta proposto

1. Detectar sinal por health, readiness, logs sanitizados, monitor externo ou relato de suporte.
2. Registrar timestamp, componente, correlação e release aplicável, sem segredo ou PII.
3. Classificar impacto sobre checkout, webhook, Buyer Access, administração, DB, R2 ou infraestrutura.
4. Validar identidade de runtime e separar incidente real de falha de monitoramento.
5. Escalonar ao responsável formalmente designado; se desconhecido, registrar `OWNER NOT ASSIGNED`.
6. Propor contenção fail-closed, sem alteração de provider ou dados nesta etapa.
7. Exigir decisão específica antes de rollback, restore, migration ou operação comercial.
8. Encerrar somente com reconciliação, evidência e revisão pós-incidente autorizada.

## 3. Matriz de contingência proposta

| Situação | Resposta documental inicial | Restrição |
| --- | --- | --- |
| Website degradado | Correlacionar health, readiness, logs e release | Sem alterar DNS, deploy ou restart |
| Checkout ou webhook inconsistente | Preservar autoridade financeira e registros sanitizados | Não reenviar pagamentos ou contornar HMAC |
| Buyer Access falho | Preservar direito persistido e auditoria fail-closed | Não reemitir credencial manualmente |
| R2 indisponível | Distinguir autenticação, permissão e falha de armazenamento | Não tornar objetos públicos |
| DB ou migration divergente | Interromper hipótese de release equivalente | Não executar migration ou SQL |
| Backup inválido | Classificar recovery point como não comprovado | Não restaurar nem excluir dados |
| Alerta sem cobertura | Registrar componente e lacuna de sinal | Não inventar SLO, owner ou monitor ativo |

### 3.1 Reconciliação das nove classes de runbook P15 — R02

O [runbook canônico P15](p15-incident-response-runbook.md)
define nove classes de tratamento. A matriz abaixo assegura cobertura
documental sem afirmar que os procedimentos foram exercitados em produção.

| Classe P15 | Preparação P18-03 | Restrição |
| --- | --- | --- |
| Application unavailable | Correlacionar monitor, health, readiness e release | Sem restart/deploy autorizado |
| Database unavailable or degraded | Correlacionar readiness, TLS, grants e capacidade | Sem SQL, migration ou reset |
| Private storage unavailable | Distinguir permissão, objeto, root e stream | Sem tornar conteúdo público |
| Payment provider degradation | Preservar autoridade financeira persistida | Sem aprovar pagamento manualmente |
| Webhook or reconciliation failure | Preservar HMAC, correlação e idempotência | Sem bypass de assinatura |
| Entitlement or delivery failure | Preservar estado persistido e auditoria | Sem reissue ou update direto |
| Security operational signal | Preservar evidência sanitizada e escalonar | Sem exposição ou mutação sem autoridade |
| Backup or restore validation failure | Invalidar ponto não comprovado e interromper cutover | Sem restore ou deleção nesta fase |
| Rate-limit infrastructure failure | Diferenciar 429 legítimo e falha do backend limiter | Fail-closed; sem relaxar proteção |

### 3.2 Papéis de resposta preservados

| Papel P15 | Responsabilidade documental |
| --- | --- |
| `OWNER_ON_CALL` | Comando de incidente de impacto comercial ou crítico |
| `OPERATIONS` | Diagnóstico, coordenação operacional e evidência |
| `COMMERCE_OPERATIONS` | Pagamentos, webhooks, pedidos, entitlement e impacto ao comprador |
| `SECURITY` | Contenção e evidência de violação de segurança |

Esses nomes são papéis abstratos; não demonstram escala, pessoa designada,
canal de paging ou integração de alerta em produção.

### 3.3 Severidades preservadas

| Severidade P15 | Critério de classificação | Objetivo qualitativo |
| --- | --- | --- |
| SEV-1 | Indisponibilidade ampla, comprometimento confirmado ou risco grave financeiro/dados | Coordenação humana imediata |
| SEV-2 | Componente importante indisponível ou falha operacional relevante recorrente | Coordenação urgente |
| SEV-3 | Degradação delimitada ou dívida operacional sem risco imediato de integridade | Investigação em horário operacional |
| SEV-4 | Anomalia informativa ou baixo impacto | Backlog e análise de tendência |

Essas classificações não criam SLOs numéricos, escalas ou contatos ativos.
Sua aplicação operacional depende de autoridade e configuração futuras.

## 4. Árvore de decisão de rollback

1. A release atual foi identificada e atestada? Se não, `STOP`.
2. O incidente e a hipótese de rollback foram correlacionados? Se não, `STOP`.
3. O target é compatível com schema, migrations e dados? Se não, `STOP`.
4. Existe backup íntegro e recuperação independentemente verificável? Se não, `STOP`.
5. Existe autoridade do owner, operador, janela, cleanup e plano de reversão? Se não, `STOP`.
6. Somente um futuro brief autorizado poderá permitir execução.

Rollback de aplicação não deve ser confundido com restauração destrutiva
de dados. Evidência de P16 não demonstra automaticamente compatibilidade P17.

## 5. Checklist para lançamento futuro

| Requisito | Situação documentada |
| --- | --- |
| Gate D PASS | NOT READY |
| Decisão formal P18 | Não emitida |
| Gate E GO | NOT AUTHORIZED |
| Autorização específica para deploy/transações | Ausente |
| Release produtiva e migrations atestadas | Não comprovadas |
| Riscos HIGH/hard stops tratados | Pendentes |
| Segredos e infraestrutura PROD verificados | Não comprovados |
| Backup/off-R2/retention/consistency | Gaps abertos |
| SLO, monitores, alert routes, on-call | Sem aceite produtivo |
| Smoke, rollback e comunicação | Somente planejamento |

## 6. Separação entre preparação e execução

P19-A01–A03 e P19-B01–B10 permanecem identificadores de planejamento.
O caminho futuro exige briefs separados, autoridades proporcionais,
revisão independente e os gates previstos pela ADR-0012.

`P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`

`P17-E05 = BLOCKED / DEFERRED`

`GATE D = NOT_READY`

`GATE E = GO NOT AUTHORIZED`

`PRODUCTION = NOT AUTHORIZED`
