# LES-P18-02 — Architecture & Security Readiness Review R01

**Projeto:** L'Essenc Digital  
**Fase:** P18 — Production Readiness Review  
**Subfase:** P18-02 — Architecture & Security Readiness Review  
**Baseline Git:** `95a422a694988e3cc656b103026ef34fa8b7b2e9`  
**Estado:** `P18-02 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT REVIEW`

## 1. Resultado executivo

A arquitetura implementada contém fronteiras fail-closed relevantes para identidade administrativa,
pagamentos, entrega privada, banco, storage e observabilidade. A inspeção estática confirma que esses
controles permanecem presentes na baseline examinada; ela não comprova que estejam configurados ou
executando em produção, nem transfere evidência hospedada de releases anteriores para o HEAD atual.

O pacote reconcilia, sem reclassificação, os 57 controles do
[inventário P18-01](../operations/p18-readiness-inventory-r01.md), as 15 pendências P17 e os 31
registros do [Risk and Blocker Register](../operations/p18-risk-and-blocker-register-r01.md).
Nenhum novo PASS técnico é emitido por esta revisão.

Estados preservados:

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED`;
- `GATE D = NOT_READY`;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `PRODUCTION = NOT AUTHORIZED`.

## 2. Autoridade, método e limites de confiança

Esta revisão foi executada sob a [ADR-0012](../decisions/ADR-0012-p17-administrative-close-p18-preparatory-exception.md)
e o [brief preparatório P18](p18-production-readiness-preparatory-phase-execution-brief.md). Foram
comparados documentos canônicos P14–P18 e código-fonte, configuração versionada, schemas e scripts
do repositório. Não houve acesso a provider, ambiente hospedado, banco, credencial, `.env` ou
`.mcp.json`; não houve execução de teste de aplicação, pagamento, webhook, migration, deploy ou fault
injection.

As camadas de evidência permanecem separadas:

| Camada | O que esta revisão pode concluir | O que não pode concluir |
| --- | --- | --- |
| documental/Git | contrato, estado registrado, identidade e presença de artefatos versionados | execução runtime ou conformidade do ambiente |
| inspeção estática | controle está presente e sua lógica aparente é compatível com o contrato | que o caminho foi exercitado ou está configurado corretamente |
| local/isolated histórica | testes documentados passaram no escopo e na release citados | comportamento hospedado atual |
| hosted/provider histórica | cenário documentado passou na release vinculada | equivalência de commits posteriores ou produção |
| produção | nenhuma evidência foi coletada nesta subfase | qualquer PASS produtivo |

Ausência de evidência é classificada como lacuna, não como falha técnica. Presença de código não é
classificada como prova hospedada.

## 3. Identidade de baseline e release

| Identidade | Papel verificável nesta revisão | Limite |
| --- | --- | --- |
| `95a422a…` | HEAD Git P18-02; merge documental PR #60 e baseline desta inspeção | Git/documental somente |
| `96b3fda…` | P17 documentary integration head e baseline histórica inicial P18-01 | não prova deploy/runtime |
| `202a43b…` | pre-PR59 technical head com R04 integrado; deploy informado pelo owner | binding, build, publish, switch e restart não atestados independentemente |
| `0f6534f…` | última release P17 com atestação Hostinger independente documentada | evidência histórica, não transferível |
| `22fad0f…` | release técnica final P16, hospedada e reconciliada | escopo P16/staging |

## 4. Visão arquitetural estática

O repositório preserva um monólito Next.js com camadas `app`, `components`, `modules`,
`infrastructure`, `lib` e `shared`. Regras de domínio e aplicação permanecem separadas dos adapters
de Prisma, Mercado Pago, R2/S3 e observabilidade. TypeScript estrito, validação de ambiente e regras
ESLint de imports restringem acoplamentos conhecidos. A portabilidade documentada continua
plausível porque a autoridade comercial reside na aplicação e em ports próprios, mas não foi
realizado teste de portabilidade, capacidade ou deployment nesta revisão.

Fluxos críticos mantêm a seguinte direção de confiança:

```text
navegador não confiável
  -> rotas/server actions validadas
  -> serviços de aplicação e autoridade persistida
  -> adapters de DB / Mercado Pago / storage
  -> projeções e respostas sanitizadas

provider/webhook não confiável
  -> autenticação HMAC e parsing estrito
  -> readback/reconciliação server-side
  -> transação idempotente
  -> entitlement/delivery somente após verdade financeira persistida
```

## 5. Avaliação por domínio

### 5.1 Next.js, módulos, dependências e ambientes

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-GOV-01`, `P18-GOV-02`, `P18-ARCH-01`–`03`, `P18-REL-01`–`05` |
| Fontes | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `package.json`, `src/`, arquitetura P16 e registros P17/P18 |
| Controles observados | strict TypeScript; ambiente `local/test/staging/production`; parsing fail-closed; headers centralizados; dependências com versões exatas/overrides; separação de módulos e adapters |
| Evidência existente | implementação estática atual; evidência local/hospedada histórica conforme cada linha do inventário |
| Lacunas | produção não configurada nem verificada; capacidade/SLO não provados; estado atual de controles GitHub não consultado; HEAD atual sem binding hospedado |
| Riscos relacionados | `P18-RSK-002`, `P18-RSK-008`, `P18-RSK-010`, `P18-RSK-013`, `P18-RSK-015`, `P18-RSK-016` |
| Critério de fechamento | release candidata imutável, comparação de código, configuração privada validada, CI/plataforma reconciliados, capacidade aceita e gates formais satisfeitos |

Conclusão: a estrutura é adequada como base de revisão, mas readiness arquitetural produtiva permanece
`PRODUCTION NOT VERIFIED`.

### 5.2 Identidade administrativa, MFA, sessão, RBAC, recovery e audit

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-SEC-03`–`07`, `P18-ID-01`–`04` |
| Fontes | `src/infrastructure/auth/admin-auth.ts`, permissões/acesso admin, mutations e audit, documentos P12/P14/P16/P17 |
| Controles observados | Better Auth isolado; cadastro desabilitado; sessões persistidas; cookie `__Host-` hospedado; MFA TOTP/backup codes; fresh-session; rate limit DB; RBAC server-side; eventos administrativos sanitizados |
| Evidência existente | contratos locais e hosted histórico para login/MFA/RBAC/projeções; inspeção estática atual |
| Lacunas | identidades/configuração production não verificadas; P17-A09 não provou escrita auditada; recovery/reissue não possui atomicidade aprovada com `AdminAuditEvent` |
| Riscos relacionados | `P18-BLK-B07`, `P18-RSK-009`, `P18-RSK-010`, `P18-RSK-012`, `P18-RSK-015` |
| Critério de fechamento | ambiente produtivo segregado; sessão/cookie/MFA negativos validados; transação atômica de revogação/reissue/audit projetada, implementada e provada |

Conclusão: autenticação e autorização têm defesa em profundidade no código, mas recovery administrativo
permanece `SAFE DEFER / BLOCKED`.

### 5.3 Mercado Pago, HMAC, idempotência e autoridade financeira

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-PAY-01`–`06` |
| Fontes | route/verifier Mercado Pago, adapter Orders API, coordinator financeiro, schema Prisma, Gate B e matriz Gate D |
| Controles observados | segredo server-side; manifest HMAC canônico; comparação temporal constante; idempotency key; readback autoritativo; correlação de IDs/conta/referência/valor/moeda/meio; estados desconhecidos fail-closed; fulfillment derivado de verdade persistida |
| Evidência existente | negativos e cenários transacionais locais; Card Brick e happy path TEST hospedados na release histórica aplicável |
| Lacunas | webhook real continua `HMAC_MISMATCH / NEITHER_MATCH`; recusa real F01 ausente; Brick não provado nos três viewports; credenciais PROD e runtime production não verificados |
| Riscos relacionados | `P18-BLK-E05`, `P18-BLK-F01`, `P18-BLK-R01`–`03`, `P18-RSK-002`, `P18-RSK-003`, `P18-RSK-015` |
| Critério de fechamento | mesma notificação correlacionada em provider/log/DB com HMAC válido; recusa TEST fail-closed; matriz responsiva real; release/schema reconciliados; produção somente após gates |

Conclusão: o desenho de autoridade financeira é coerente; a evidência faltante impede Gate D e qualquer
promoção produtiva.

### 5.4 Entitlements, Buyer Access e entrega digital

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-DEL-01`–`05` |
| Fontes | credenciais/sessão Buyer, autorização de recurso, delivery service/route, adapters de storage, P11/P12 e Gate D |
| Controles observados | credencial opaca de alta entropia; apenas digest persistido; sessão HMAC com claims estritos; entitlement revalidado server-side; MIME allowlist; autorização antes do acesso a storage; audit obrigatório antes de liberar bytes; erros genéricos |
| Evidência existente | provas locais; Range/206 e negações 401/404 com R2 privado em hosted histórico |
| Lacunas | B01 externo pendente; B03–B07 não executados/deferred; stream/storage/audit failure sem autoridade exigida; recovery administrativo bloqueado |
| Riscos relacionados | `P18-BLK-B01`, `P18-BLK-B03`–`B07`, `P18-RSK-012`, `P18-RSK-015` |
| Critério de fechamento | matriz fail-closed controlada para credencial, rate limit, storage, stream e audit; recovery atômico; correlação na release autorizada |

Conclusão: o happy path privado tem evidência histórica forte, mas o conjunto de falhas obrigatório não
está fechado.

### 5.5 Prisma, DB, migrations, grants, transporte e rollback

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-DB-01`–`06` |
| Fontes | `prisma/schema.prisma`, migrations, cliente MySQL, verifier de grants, migration guard, scripts de release/recovery e documentos P16/P17 |
| Controles observados | schema relacional com constraints; TLS estrito/CA; hostname validation; runtime DML-only verificado por política; migration window e release binding fail-closed; rollback separado de data recovery |
| Evidência existente | integração local histórica; TLS/grants/migrations P16 hospedados; compatibilidade de rollback P16 documental/correlacionada |
| Lacunas | nona migration F06 apenas provada localmente; schema/grants/certificados production não verificados; compatibilidade de rollback não recalculada para release atual |
| Riscos relacionados | `P18-RSK-002`, `P18-RSK-003`, `P18-RSK-006`, `P18-RSK-010`, `P18-RSK-015` |
| Critério de fechamento | release/migration tree/schema/grants/TLS reconciliados; backup pré-janela; plano de rollback compatível; toda mutação somente em janela autorizada |

Conclusão: controles de transporte e menor privilégio existem, mas a autoridade hospedada atual e a
fronteira produtiva permanecem desconhecidas.

### 5.6 R2, arquivos privados e privilégios runtime

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-DEL-02`, `P18-DEL-03`, `P18-BCP-03`, `P18-BCP-05` |
| Fontes | configured storage, S3-compatible adapter, storage-key policy, readiness probes e P16-H3 |
| Controles observados | resolução lazy após autorização; hosted sem fallback local; apenas Head/Get; streaming; ETag/If-Match; normalização de erro; chaves fora de diretórios públicos; readiness por sentinel privado |
| Evidência existente | aplicação local e menor privilégio/R2 hospedado na release P16; delivery hosted histórica P17 |
| Lacunas | bucket/identidade production não verificados; cópia final off-R2 não provada; falhas B04/B05 pendentes |
| Riscos relacionados | `P18-BLK-B04`, `P18-BLK-B05`, `P18-RSK-005`, `P18-RSK-010`, `P18-RSK-015` |
| Critério de fechamento | private-by-default e read-only provados no ambiente autorizado; negativo de escrita/publicidade; fault paths; cópia cifrada em domínio independente |

Conclusão: a interface runtime aplica menor privilégio, mas configuração produtiva e resiliência externa
não foram demonstradas.

### 5.7 CSP, HTTPS, APIs, logging e supply chain

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-SEC-01`–`07`, `P18-NET-01`, `P18-NET-02` |
| Fontes | `next.config.ts`, security headers, proxy, logger/redaction, readiness auth, workflows GitHub, Dependabot e política `LES-SEC-RA-001` |
| Controles observados | HSTS hospedado; nosniff/referrer/permissions/frame policy; CSP route-sensitive; IDs de correlação server-owned; bearer readiness com digest/timing-safe compare; redaction recursiva; workflows pinados; CodeQL; evaluator fail-closed do risco temporário |
| Evidência existente | testes/documentação locais e hosted histórico; inspeção estática da baseline |
| Lacunas | `unsafe-inline` script MEDIUM/style LOW; `.htaccess` deve ser revalidado após deploy; plataforma GitHub atual não consultada; quatro nós HIGH dev/CI permanecem |
| Riscos relacionados | `P18-RSK-001`, `P18-RSK-007`, `P18-RSK-008`, `P18-RSK-009`, `P18-RSK-013`, `P18-RSK-015` |
| Critério de fechamento | remediação oficial de `braces`; audit completo; nonce/hash se aprovado; regressão provider/browser; headers/redirect e CI/plataforma revalidados na release |

`LES-SEC-RA-001` permanece `HIGH / DEVELOPMENT-CI ONLY / PRODUCTION BLOCKED`, com expiração
em `13/11/2026 23:59:59 America/Sao_Paulo`. Esta revisão não amplia nem renova a aceitação.

### 5.8 Backup, retenção, recuperação e consistência

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-BCP-01`–`07`, `P18-REL-04` |
| Fontes | scripts P16 de recovery/orchestration/retention, P15 policy, P16-08 e P16-09 |
| Controles observados | dump guardado e release-bound; recovery unit cifrada/autenticada; paths/symlinks protegidos; restore isolado; RPO/RTO exatos; scheduler authority explícita; índice serializado por lock exclusivo; rollback apenas plan-only |
| Evidência existente | hosted P16 com RPO 888 ms e RTO abaixo de 8 h; prova de compatibilidade de rollback P16 |
| Lacunas | retenção 7/4/3 apenas `PLAN_ONLY`; sem deleção/lifecycle autorizados; ponto final sem off-R2 independente; captura DB/R2 sequencial; rollback live não executado |
| Riscos relacionados | `P18-RSK-004`, `P18-RSK-005`, `P18-RSK-006`, `P18-RSK-015` |
| Critério de fechamento | cobertura 7/4/3 verificada com hold/rollback; cópia cifrada independente e restore; protocolo de consistência/reconciliação; rehearsal vinculado à release de lançamento |

Conclusão: recuperação P16 tem evidência relevante, porém três limitações estruturais continuam abertas
e impedem inferência de readiness produtiva.

### 5.9 Observabilidade, alertas, readiness e incidentes

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-OBS-01`–`03`, `P18-OPS-01`, `P18-NET-01`, `P18-NET-02` |
| Fontes | health/readiness handlers, telemetry/logger, alert policy, hosted observability, P15 runbooks e P16 |
| Controles observados | liveness pública separada de readiness protegida; status sanitizado; spans/métricas; catálogo de alertas por severidade/componente; deduplicação; runbooks e lifecycle de incidentes documentados |
| Evidência existente | testes locais e monitores/alert delivery históricos de staging P16 |
| Lacunas | targets continuam `OPEN_STAGING_BASELINE`; cobertura pública limitada; rotas de alerta, on-call, retenção e sinais production não verificados; readiness secret deve ser rotacionado |
| Riscos relacionados | `P18-RSK-008`, `P18-RSK-009`, `P18-RSK-010`, `P18-RSK-011`, `P18-RSK-015` |
| Critério de fechamento | monitors por componente, amostras/SLO aceitos, alert routes/on-call, status projection e incident drill vinculados à release produtiva |

Conclusão: a fundação existe, mas não há baseline operacional produtiva.

### 5.10 Escalabilidade, capacidade e desempenho

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-ARCH-03`, `P18-PERF-01`, `P18-UX-01` |
| Fontes | rate limits, DB pool, pacote local de performance e matriz Gate D |
| Controles observados | rate limiting DB-backed; pool limitado; budget aprovado; cápsula local com medições numéricas e matriz browser |
| Evidência existente | regressões e números locais/provisórios; nenhuma aceitação Gate D |
| Lacunas | `PR01`–`PR04` continuam provisional/deferred; provenance/authority insuficientes; capacidade hosting/DB/concorrência/SLO production desconhecida; R01–R03 incompletos |
| Riscos relacionados | `P18-BLK-R01`–`03`, `P18-BLK-PR01`–`04`, `P18-RSK-011`, `P18-RSK-016` |
| Critério de fechamento | autoridade da cápsula reconciliada; critérios aprovados aplicados à release; validação não destrutiva de capacidade e matriz responsiva real |

Conclusão: números existentes são diagnóstico, não PASS.

### 5.11 Consentimento, analytics, privacidade e integrações de política

| Campo | Avaliação |
| --- | --- |
| Controles P18-01 | `P18-ANA-01`–`04` |
| Fontes | consent projection/update, canonical analytics events, provider dispatch, Meta CAPI boundary e P13-H |
| Controles observados | consentimento explícito/persistido/reversível; snapshot de policy version; autoridade financeira isolada; dispatch provider-neutral; configuração server-side separada; Meta CAPI bloqueada por política |
| Evidência existente | implementação/testes locais históricos; providers browser não aplicáveis na execução P17 quando não configurados |
| Lacunas | produção e política de retenção/privacidade não verificadas; GTM/Meta runtime final não validado; matching data não autorizado |
| Riscos relacionados | `P18-RSK-010`, `P18-RSK-014`, `P18-RSK-015` |
| Critério de fechamento | decisão de privacidade explícita, minimização, consent mapping, configuração e smoke autorizados; Meta permanece desligada enquanto política bloquear |

Conclusão: o isolamento de política está implementado; ativação não é autorizada.

## 6. Reconciliação dos 57 controles

Os onze domínios contêm 70 referências a controles P18-01, correspondentes a 57 IDs únicos.
As 13 referências adicionais são transversais/secundárias e não representam novos controles.
A unicidade aplica-se aos IDs do inventário canônico P18-01, não à quantidade de vezes
que um controle aparece nas avaliações por domínio. A contagem por família preservada é:

| Família | IDs reconciliados | Quantidade | Domínios principais |
| --- | --- | ---: | --- |
| GOV | `P18-GOV-01`, `P18-GOV-02` | 2 | 5.1 |
| ARCH | `P18-ARCH-01`, `P18-ARCH-02`, `P18-ARCH-03` | 3 | 5.1 e 5.10 |
| REL | `P18-REL-01`, `P18-REL-02`, `P18-REL-03`, `P18-REL-04`, `P18-REL-05` | 5 | 5.1 e 5.8 |
| SEC | `P18-SEC-01`, `P18-SEC-02`, `P18-SEC-03`, `P18-SEC-04`, `P18-SEC-05`, `P18-SEC-06`, `P18-SEC-07` | 7 | 5.2 e 5.7 |
| ID | `P18-ID-01`, `P18-ID-02`, `P18-ID-03`, `P18-ID-04` | 4 | 5.2 |
| DB | `P18-DB-01`, `P18-DB-02`, `P18-DB-03`, `P18-DB-04`, `P18-DB-05`, `P18-DB-06` | 6 | 5.5 |
| PAY | `P18-PAY-01`, `P18-PAY-02`, `P18-PAY-03`, `P18-PAY-04`, `P18-PAY-05`, `P18-PAY-06` | 6 | 5.3 |
| DEL | `P18-DEL-01`, `P18-DEL-02`, `P18-DEL-03`, `P18-DEL-04`, `P18-DEL-05` | 5 | 5.4 e 5.6 |
| BCP | `P18-BCP-01`, `P18-BCP-02`, `P18-BCP-03`, `P18-BCP-04`, `P18-BCP-05`, `P18-BCP-06`, `P18-BCP-07` | 7 | 5.6 e 5.8 |
| OBS | `P18-OBS-01`, `P18-OBS-02`, `P18-OBS-03` | 3 | 5.9 |
| OPS | `P18-OPS-01` | 1 | 5.9 |
| NET | `P18-NET-01`, `P18-NET-02` | 2 | 5.7 e 5.9 |
| ANA | `P18-ANA-01`, `P18-ANA-02`, `P18-ANA-03`, `P18-ANA-04` | 4 | 5.11 |
| UX | `P18-UX-01` | 1 | 5.10 |
| PERF | `P18-PERF-01` | 1 | 5.10 |
| **Total** | **57 IDs únicos** | **57** | **reconciliados** |

Os 13 IDs referenciados em dois domínios são: `P18-ARCH-03`, `P18-REL-04`,
`P18-SEC-03`–`07`, `P18-DEL-02`–`03`, `P18-BCP-03`, `P18-BCP-05` e
`P18-NET-01`–`02`. Cada um possui uma referência transversal adicional.
Os domínios indicam cobertura temática, não propriedade primária exclusiva.
As repetições não modificam os 57 controles canônicos nem suas classificações.

## 7. Findings consolidados da revisão

| ID | Finding | Classificação | Disposição |
| --- | --- | --- | --- |
| P18-02-F01 | A baseline física preserva os principais controles fail-closed descritos nos documentos | observação estática; sem novo PASS | usar como suporte para work packages futuros |
| P18-02-F02 | Não existe binding hospedado independente para `95a422a…`, `96b3fda…` ou o deploy informado de `202a43b…` | release blocker; severidade não atribuída | correlação externa futura sob brief próprio |
| P18-02-F03 | Gate D mantém 15 pendências, com E05 bloqueado e falhas/provider/browser/performance incompletos | estados herdados | transportar integralmente; não reabrir Gate D por documento |
| P18-02-F04 | `LES-SEC-RA-001` continua HIGH e bloqueia produção | HIGH herdado | remediação definitiva antes da expiração/P19 closeout |
| P18-02-F05 | Retenção, off-R2 e consistência DB/R2 permanecem incompletas | severidades não atribuídas na fonte | work package de continuidade separado |
| P18-02-F06 | Recovery administrativo não tem atomicidade reissue/audit aprovada | estado herdado `SAFE DEFER / BLOCKED` | arquitetura e prova adversarial antes de exposição |
| P18-02-F07 | CSP parcial, revalidação pós-deploy e controles GitHub atuais continuam abertos | MEDIUM/LOW apenas onde herdado; demais sem nova severidade | hardening e inspeção futura autorizada |
| P18-02-F08 | Observabilidade, capacidade, performance e privacidade carecem de evidência produtiva | produção não verificada | definir owners, SLOs e critérios sem executar nesta fase |

## 8. Decisão preparatória

A revisão não identifica base probatória para Gate E GO ou produção. Ela produz um mapa revisável de
controles e gaps, sem execução de remediação e sem substituir a revisão técnica independente.

`P18-02 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT REVIEW`

`GATE D = NOT_READY`

`GATE E = GO NOT AUTHORIZED`

`PRODUCTION = NOT AUTHORIZED`
