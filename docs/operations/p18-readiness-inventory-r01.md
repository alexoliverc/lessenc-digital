# LES-P18-READINESS-INVENTORY-R01 — Baseline & Readiness Inventory

**Fase:** P18 — Production Readiness Review

**Subfase:** P18-01 — Baseline & Readiness Inventory

**Data da consolidação:** 18/10/2026

**Baseline documental:** `96b3fda29775b2db7d364b292b46b8bc3aefd364`

**Estado:** `PREPARATORY CANDIDATE / AWAITING INDEPENDENT RE-REVIEW`

## 1. Autoridade e limites

Este inventário executa somente a preparação documental autorizada por
`LES-OWNER-DEC-20261017-P17-P18-R01`, formalizada no
[ADR-0012](../decisions/ADR-0012-p17-administrative-close-p18-preparatory-exception.md) e delimitada
pelo
[LES-P18-PREPARATORY-BRIEF-R01](../architecture/p18-production-readiness-preparatory-phase-execution-brief.md).
Ele não constitui decisão formal P18, checkpoint, waiver, autorização de produção ou substituto de
evidência hospedada/provedor.

Estados obrigatórios preservados:

- `P17 = ADMINISTRATIVELY CLOSED / DEFERRED ITEMS`;
- `P17-E05 = BLOCKED / DEFERRED`;
- `GATE D = NOT_READY`;
- `P18 = PREPARATORY EXECUTION AUTHORIZED / OWNER EXCEPTION`;
- `GATE E = GO NOT AUTHORIZED`;
- `PRODUCTION = NOT AUTHORIZED`.

## 2. Vocabulário de evidência

| Classificação | Uso neste inventário |
| --- | --- |
| `PASS / HOSTED PROVEN` | Controle comprovado em ambiente hospedado, limitado à release, superfície e data originais. |
| `PASS / LOCAL TEST PROVEN` | Controle comprovado por testes locais/isolados; não é prova hospedada nem produtiva. |
| `PASS / DOCUMENTARY PROVEN` | Estado de governança, Git ou documento reconciliado, sem inferência de runtime. |
| `PROVISIONAL / DIAGNOSTIC ONLY` | Evidência útil, porém insuficiente para aceite ou Gate D. |
| `PENDING_EXTERNAL / NOT_EXECUTED` | Evidência externa ou execução obrigatória ausente. |
| `BLOCKED / DEFERRED` | Obrigação preservada para saneamento posterior; não equivale a dispensa. |
| `PRODUCTION NOT VERIFIED` | Controle provado em staging/local ou apenas especificado, sem prova no ambiente produtivo. |

As camadas usadas são `Git/documental`, `local/static`, `local/isolated`, `hosted`,
`provider-private` e `independently correlated`. Uma camada mais forte não amplia automaticamente o
escopo temporal, funcional ou de release da evidência.

## 3. Identidade de releases e precedência

| Referência | Fato comprovado | Limite obrigatório |
| --- | --- | --- |
| `22fad0f690618c27cabcfa58528a76ce0a580ad3` | Release técnica P16 congelada, hospedada, validada e vinculada ao scheduler/backup final. | Prova P16/staging; não representa produção nem a release P17 atual. |
| `9e2ef25f4667b19f727c6ba1e277a79f55e3086f` | Release em que G5/F3/P9 foram exercidos. | Evidência funcional hospedada original. |
| `0f6534fcf1d5b87588f21f6dd64005309a50c786` | Última release Hostinger independentemente atestada no dossiê P17; P17-L04 `PASS / HOSTED PROVEN`. | Equivalência de código comprovada somente entre `9e2ef25…` e `0f6534f…`. |
| `202a43bffd30ed2b85c22c83825da7697139e3a8` | HEAD técnico anterior ao merge documental; inclui R04 `f01a683…`. Implantação Hostinger informada pelo proprietário. | Não é mais o HEAD Git integrado da branch P17. Binding, build, publish, current-version switch e restart continuam sem atestação independente; nenhum PASS histórico é propagado. |
| `96b3fda29775b2db7d364b292b46b8bc3aefd364` | HEAD Git integrado da branch P17 após o merge documental PR #59 e baseline desta execução P18-01. | Autoridade Git/documental somente; não declara deploy, equivalência de código, runtime hospedado ou P17-L04 PASS. |

## 4. Matriz de prontidão

### 4.1 Governança, arquitetura e release

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-GOV-01 | Precedência e separação de fases — `AGENTS.md`, `MEMORY.md`, `ROADMAP.md`, [ADR-0012](../decisions/ADR-0012-p17-administrative-close-p18-preparatory-exception.md) | Estados P17/P18/Gates reconciliados e owner exception formalizada. | Git/documental | PASS / DOCUMENTARY PROVEN | Revisão independente deste pacote ainda pendente. | Impede que completude documental seja confundida com GO. | Owner para decisões; prazo não definido. | Revisar este changeset sem abrir Gate D/Gate E. |
| P18-GOV-02 | Baselines P14–P16 — [P14](../security/p14-security-hardening-candidate.md), [P15](p15-final-gate.md), [P16](p16-final-technical-gate.md) | P14, P15/Gate C e P16 fechados em seus escopos/checkpoints canônicos. | Git/documental + hosted conforme cada fase | PASS / DOCUMENTARY PROVEN | Evidência continua release-bound; não prova produção. | Preserva controles aprovados sem repetir testes. | Não definido; sem prazo. | Usar como entrada P18, revalidando somente quando houver razão/release nova. |
| P18-ARCH-01 | Monólito Next.js portável e fronteiras provider-neutral — [arquitetura P16](../architecture/p16-staging-deployment-architecture.md) | Hostinger Managed Node usado sem mover regras de negócio para APIs proprietárias. | Git/documental + hosted/staging | PASS / HOSTED PROVEN | Portabilidade produtiva e configuração final não exercidas. | Lock-in e falha de migração podem afetar lançamento. | Não definido; sem prazo. | Revisar arquitetura de produção sob brief posterior, sem mutação nesta subfase. |
| P18-ARCH-02 | Separação `local/test/staging/production` — [arquitetura P16](../architecture/p16-staging-deployment-architecture.md) | Preflight staging fail-closed e isolamento de DB, storage, secrets e credenciais TEST. | local/static + hosted/staging | PASS / HOSTED PROVEN | Ambiente production e seus recursos não foram verificados. | Configuração cruzada pode expor dados ou ativar credenciais erradas. | Não definido; antes de P19-C. | Preparar checklist P19-A; executar validação produtiva somente com nova autoridade. |
| P18-ARCH-03 | Capacidade e escalabilidade — [P14](../security/p14-security-hardening-candidate.md), [arquitetura P16](../architecture/p16-staging-deployment-architecture.md), [Gate D](p17-gate-d-evidence-matrix.md) | Rate limits DB-backed e package local de performance existem; nenhum teste de capacidade produtiva ou SLO fechado. | local/static + diagnostic | PROVISIONAL / DIAGNOSTIC ONLY | Capacidade de banco, hosting, rate limits e concorrência produtiva não verificada. | Saturação pode degradar checkout, webhook, Buyer Access e administração. | Não definido; sem prazo. | Definir modelo de carga/SLO e validação não destrutiva em brief posterior. |
| P18-REL-01 | Release final P16 — [P16-09](p16-final-technical-gate.md) | `22fad0f…` vinculada a aplicação, readiness, scheduler e recovery point. | independently correlated | PASS / HOSTED PROVEN | Escopo limitado ao staging P16. | É a última baseline P16 integralmente reconciliada. | Não definido; sem prazo. | Preservar checkpoint; não retarget. |
| P18-REL-02 | Release P17 histórica — [matriz Gate D](p17-gate-d-evidence-matrix.md) | `0f6534f…` teve preflight, build, publish, switch e restart atestados; delta de app desde `9e2ef25…` era zero. | hosted + independently correlated | PASS / HOSTED PROVEN | Resultado não se transfere a commits posteriores. | Evita falsa prova de release atual. | Não definido; sem prazo. | Manter como evidência histórica. |
| P18-REL-03 | HEAD integrado P17 `96b3fda…` e parent técnico `202a43b…` — [arquitetura P17](../architecture/p17-validation-architecture.md) | PR #59 integrou documentação sobre `202a43b…`; R04 já estava no parent técnico. O owner informou deploy Hostinger de `202a43b…`. | Git/documental; owner report | PASS / DOCUMENTARY PROVEN | Atestação independente do deploy informado de `202a43b…` e comparação de código até `96b3fda…` ausentes. | Impede atribuir runtime, equivalência ou P17-L04 aos commits posteriores a `0f6534f…`. | Não definido; sem prazo. | A correlação externa depende de novo brief e autorização específica; não pertence à P18-02 documental. |
| P18-REL-04 | Rollback P16 — [P16-09](p16-final-technical-gate.md) | Compatibilidade não mutável `22fad0f…` → `976a047…`; schema/migrations idênticos, sem delta runtime não teste. | Git/documental + independently correlated | PASS / HOSTED PROVEN | Rollback real não executado; target reverte patch Next 16.3.8 → 16.3.4. | Target é break-glass, não runtime preferencial. | Não definido; autorização específica para deploy. | Preparar árvore de decisão P19-A; revalidar contra release de lançamento. |
| P18-REL-05 | Deploy/smoke de produção — `ROADMAP.md` P19-C | Requisitos definidos, nenhuma execução produtiva. | Git/documental | PRODUCTION NOT VERIFIED | Gate D, decisão P18, Gate E e owner authorization ausentes. | Hard stop para lançamento. | Owner; sem prazo. | Não executar antes dos quatro gates explícitos. |

### 4.2 Segurança, identidade administrativa e dados sensíveis

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-SEC-01 | Headers globais e CSP — [P14](../security/p14-security-hardening-candidate.md), [P16-07](../security/p16-hosted-security-validation.md) | CSP route-sensitive, HSTS, nosniff, frame denial, referrer e permissions headers; override Hostinger remediado. | hosted/staging | PASS / HOSTED PROVEN | `script-src 'unsafe-inline'` MEDIUM e `style-src 'unsafe-inline'` LOW permanecem; redeploy pode alterar `.htaccess`. | Redução de defesa XSS/CSP e regressão de redirect. | Não definido; sem prazo. | Revalidar headers/redirect na release de lançamento; nonce/hash exige arquitetura separada. |
| P18-SEC-02 | TLS/HTTPS/DNS staging — [P16-07](../security/p16-hosted-security-validation.md) | TLS 1.3, hostname/cadeia, HTTP→HTTPS, HSTS e `status.lessenc.com.br` validados nas datas P16. | hosted/staging | PASS / HOSTED PROVEN | Certificado, DNS e edge são temporais; produção não verificada. | TLS/DNS inválido impede ou expõe lançamento. | Não definido; antes de P19-C. | Revalidar temporalmente sob brief de release. |
| P18-SEC-03 | Redação de logs e respostas — [P14](../security/p14-security-hardening-candidate.md), [P15](p15-final-gate.md) | Redação recursiva, IDs de correlação opacos, erros e superfícies sensíveis sanitizados. | local/static + hosted negatives | PASS / LOCAL TEST PROVEN | Logs/retention produtivos e integrações finais não verificados. | Vazamento de segredo/PII bloquearia produção. | Não definido; sem prazo. | Incluir verificação de logs no plano de smoke, sem registrar valores sensíveis. |
| P18-SEC-04 | Segredos fora do Git e bundles públicos — [P16-07](../security/p16-hosted-security-validation.md) | `.env*` ignorados, `.env.example` fictício, assets hosted varridos sem nomes server-only/chave privada. | Git/static + hosted/staging | PASS / HOSTED PROVEN | Rotação e segregação de segredos production não verificadas. | Reuso/vazamento de staging em produção é hard stop. | Não definido; antes de P19-C. | Inventariar somente nomes/purpose em P19-A; validar valores privadamente sob autoridade específica. |
| P18-SEC-05 | Dependências runtime — [P16-09](p16-final-technical-gate.md), [LES-SEC-RA-001](../security/les-sec-ra-001-temporary-braces-risk-acceptance.md) | Runtime audit P16/P17 local sem vulnerabilidades; quatro nós HIGH na cadeia dev/CI. | local/static | PASS / LOCAL TEST PROVEN | Metadados de advisory podem derivar; produção não deve aceitar `LES-SEC-RA-001`. | Finding ativo bloqueia promoção produtiva. | Responsável não definido; expira 13/11/2026 23:59:59 America/Sao_Paulo. | Remediar por caminho oficial e repetir regressões antes de produção. |
| P18-SEC-06 | `LES-SEC-RA-001` — [registro](../security/les-sec-ra-001-temporary-braces-risk-acceptance.md) | Aceitação exata de `GHSA-vfj7-8cjw-p6xm` em `braces@3.0.3`, dev/CI somente, evaluator fail-closed. | local/static + governance | BLOCKED / DEFERRED | HIGH ativo; enforcement hospedado de promoção ainda não existe. | Production hard stop. | Responsável não definido; aceitação ratificada pelo owner; 13/11/2026 23:59:59 America/Sao_Paulo ou antes do closeout P19. | Remediação definitiva, audit completo, regressões e revisão separada. |
| P18-ID-01 | Isolamento Buyer/Admin, login, MFA, sessão e RBAC — [P12 final](p12-final-gate.md) | Better Auth, MFA TOTP/códigos, sessões DB, server-side RBAC e audit; contratos locais completos. | local/isolated | PASS / LOCAL TEST PROVEN | Configuração/identidades de produção não verificadas. | Falha expõe backoffice e dados comerciais. | Não definido; sem prazo. | Preservar contratos; validar ambiente produtivo somente no gate autorizado. |
| P18-ID-02 | Admin real em staging — [matriz Gate D](p17-gate-d-evidence-matrix.md) | Login, MFA, sessão, OWNER RBAC e projeções read-only hospedadas passaram na release de evidência. | hosted/staging | PASS / HOSTED PROVEN | A09 não exercitou escrita de `AdminAuditEvent`; o deploy informado do parent técnico `202a43b…` e o HEAD integrado `96b3fda…` não possuem atestação hospedada independente. | Administração nos commits posteriores não pode ser presumida idêntica. | Não definido; sem prazo. | Manter PASS histórico; qualquer correlação externa exige brief e autorização próprios. |
| P18-ID-03 | Cookie/sessão admin — [P16-07](../security/p16-hosted-security-validation.md) | Cookie `__Host-`, Secure/HttpOnly/SameSite/Path, 8 h absoluto, 30 min idle, 5 min fresh. | hosted/staging + local | PASS / HOSTED PROVEN | Produção e sessão na release de lançamento não verificadas. | Se incorreto, aumenta risco de sequestro/fresh-auth bypass. | Não definido; sem prazo. | Revalidar atributos sem expor cookie no futuro smoke autorizado. |
| P18-ID-04 | Recuperação administrativa de entrega — [P12 final](p12-final-gate.md) | `delivery.recover` definido, mas nenhuma ação exposta sem atomicidade entre reissue e audit. | Git/documental + local | BLOCKED / DEFERRED | Fronteira atômica audit/reissue ainda não aprovada/provada. | Suporte não pode reemitir com segurança por UI; update direto é proibido. | Não definido; sem prazo. | Projetar work package P19-B separado; não improvisar operação manual. |
| P18-SEC-07 | CI/CodeQL/ações pinadas — [P14](../security/p14-security-hardening-candidate.md) | PR #36 quality/security e CodeQL passaram; actions pinadas e Dependabot versionado. | hosted CI histórica | PASS / HOSTED PROVEN | Estado atual de branch protection, alerts e secret scanning não foi verificado nesta execução. | Ausência de controles de plataforma reduz prevenção de regressão. | Não definido; sem prazo. | Auditoria read-only de plataforma sob autorização futura; não inferir estado atual do snapshot P14. |

### 4.3 Banco de dados, migrations e consistência

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-DB-01 | TLS e identidade do MariaDB — [P16 internal gate](p16-internal-gate.md) | Hostname positivo, IP negativo, TLS estrito e runtime com CA/rejectUnauthorized. | hosted/staging | PASS / HOSTED PROVEN | Certificados/endpoint de produção não verificados. | Conexão indevida ou sem autenticação impede produção. | Não definido; antes de P19-C. | Validar identidade efetiva no ambiente autorizado de lançamento. |
| P18-DB-02 | Migrations P16 e guard — [P16 internal gate](p16-internal-gate.md) | Oito migrations aplicadas, release binding e migration window fail-closed. | hosted/staging | PASS / HOSTED PROVEN | Evidência pertence à baseline P16. | Drift de schema/release pode quebrar deploy/rollback. | Não definido; sem prazo. | Reconciliar migration tree exata da release de lançamento. |
| P18-DB-03 | Privilégios runtime — [P16 internal gate](p16-internal-gate.md) | `USAGE` global, DML necessário, sem ALL/GRANT OPTION; extras provider-managed limitados e superfícies ausentes. | provider-private + hosted | PASS / HOSTED PROVEN | Grants production e superfícies futuras não verificados. | Privilégio excessivo ou insuficiente é blocker. | Não definido; antes de P19-C. | Repetir verifier na identidade produtiva autorizada. |
| P18-DB-04 | Migration P17 F06 — [matriz Gate D](p17-gate-d-evidence-matrix.md) | Nona migration e `Order.EXPIRED` provaram-se apenas em `lessenc_test`; código publicado na P17. | local/isolated | PASS / LOCAL TEST PROVEN | Aplicação da migration/compatibilidade hosted no deploy informado de `202a43b…` não atestada; `96b3fda…` acrescenta documentação, não prova schema hospedado. | A release informada pode não ter schema compatível. | Não definido; sem prazo. | Correlação hosted depende de novo brief e autorização específica; não aplicar migration nesta fase. |
| P18-DB-05 | Produção DB/migrations/grants — `ROADMAP.md` P18/P19 | Nenhuma inspeção ou execução produtiva. | none | PRODUCTION NOT VERIFIED | Identidade, isolamento, backup e migration plan produtivos pendentes. | Hard stop de P19-C. | Owner; sem prazo. | Criar checklist P19-A e executar apenas após gates. |
| P18-DB-06 | Rollback/schema compatibility — [P16-09](p16-final-technical-gate.md) | `22fad0f…` e `976a047…` com schema/migration tree byte-identical. | Git/documental | PASS / DOCUMENTARY PROVEN | Não cobre deltas P17 até a release candidata atual. | Rollback P17 pode ser incompatível se não reavaliado. | Não definido; sem prazo. | Recalcular compatibilidade para a release final antes de qualquer rollback real. |

### 4.4 Pagamentos, webhooks, pedidos e entitlement

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-PAY-01 | Autoridade financeira server-side — [Gate B](gate-b-commerce-core-ready.md), [P14](../security/p14-security-hardening-candidate.md) | Browser não concede estado financeiro; snapshots autenticados são reconciliados a Order/Payment. | local/isolated | PASS / LOCAL TEST PROVEN | Runtime production e credenciais PROD não verificados. | Evita fulfillment por estado controlado pelo cliente. | Não definido; sem prazo. | Preservar invariante em qualquer work package futuro. |
| P18-PAY-02 | Mercado Pago TEST/Card Brick — [matriz Gate D](p17-gate-d-evidence-matrix.md) | F3 hospedado: Brick real, uma submissão TEST, Order PAID/Payment APPROVED; sem 3DS disparado. | hosted/provider TEST | PASS / HOSTED PROVEN | Evidência não cobre os três viewports, webhook real autenticado nem PROD. | Jornada parcial não satisfaz Gate D. | Não definido; sem prazo. | Resolver R01–R03/E05/F01 em janela separadamente autorizada. |
| P18-PAY-03 | Assinatura de webhook TEST — [matriz Gate D](p17-gate-d-evidence-matrix.md) | Negativos locais passam; entregas reais observadas resultaram em `HMAC_MISMATCH / NEITHER_MATCH`, sem prova autenticada. | diagnostic/provider-adjacent | BLOCKED / DEFERRED | Causa definitiva e entrega `order.processed` autenticada ausentes. | Gate D blocker; produção não pode depender de webhook não autenticado. | Não definido; sem prazo. | Investigação read-only/provider + correlação hosted/DB sob autorização própria; segredo só com procedimento específico. |
| P18-PAY-04 | Idempotência/reordenação/retry — [matriz Gate D](p17-gate-d-evidence-matrix.md) F02–F08 | Timeout, duplicidade, fora de ordem, retry, expirado, attempt duplicado e auth inválida passaram localmente; F06 regression proven. | local/isolated | PASS / LOCAL TEST PROVEN | Não constitui webhook provider/hosted real; F06 migration hosted não provada. | Reduz risco de mutação dupla, mas não fecha jornada. | Não definido; sem prazo. | Preservar PASS local e executar somente evidência externa faltante. |
| P18-PAY-05 | Pagamento recusado real — P17-F01 na [matriz Gate D](p17-gate-d-evidence-matrix.md) | Nenhuma observação provider real aceita. | none | PENDING_EXTERNAL / NOT_EXECUTED | Comportamento de recusa real e ausência de entitlement não provados. | Gate D blocker. | Não definido; sem prazo. | Executar um cenário TEST controlado em brief futuro; sem pagamento nesta etapa. |
| P18-PAY-06 | Entitlement e fulfillment — [Gate B](gate-b-commerce-core-ready.md), [matriz Gate D](p17-gate-d-evidence-matrix.md) | Jornada hospedada E06–E10 e controles locais de refund/revocation preservados. | hosted/staging + local/isolated | PASS / HOSTED PROVEN | Evidência histórica/release-bound; E05 e falhas Buyer permanecem. | Happy path provado, mas Gate D ainda incompleto. | Não definido; sem prazo. | Não repetir happy path sem justificativa; sanar somente gaps. |

### 4.5 Buyer Access, entrega protegida e R2

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-DEL-01 | Autorização por entitlement/recurso — [P11 final](p11-final-gate.md) | Estado persistido revalidado; negação não libera bytes nem cria delivery event. | local/isolated | PASS / LOCAL TEST PROVEN | Produção não verificada. | Impede acesso indevido ao produto. | Não definido; sem prazo. | Preservar e incluir smoke negativo autorizado no lançamento. |
| P18-DEL-02 | Entrega hospedada e Range — [matriz Gate D](p17-gate-d-evidence-matrix.md) G5 | Missing/invalid session 401, recurso não autorizado 404, autorizado 206, audit SUCCEEDED, sem URL/chave R2. | hosted/staging | PASS / HOSTED PROVEN | Release de evidência é histórica; B01/B03–B07 continuam abertos. | Prova principal de entrega privada, não de todas as falhas. | Não definido; sem prazo. | Preservar PASS G5; não reabrir sem drift comprovado. |
| P18-DEL-03 | R2 privado/runtime least privilege — [P16 internal gate](p16-internal-gate.md) | Runtime Object Read only, write negado; app usa Head/Get, sem public/presigned/List/Delete/Put. | provider-private + local application | PASS / HOSTED PROVEN | Produção, credenciais e bucket production não verificados. | Exposição pública ou write runtime bloquearia lançamento. | Não definido; antes de P19-C. | Validar identidade e exposição no ambiente autorizado, sem imprimir credenciais. |
| P18-DEL-04 | Falhas Buyer/Storage/Audit/Recovery — P17-B01/B03–B07 na [matriz Gate D](p17-gate-d-evidence-matrix.md) | B01 pendente externo; B03–B07 não executados/deferred. | none/partial local | BLOCKED / DEFERRED | Negação real, rate limit, indisponibilidade, stream, audit failure e recovery faltam. | Três itens são Gate D CRITICAL e os demais risco residual obrigatório. | Não definido; sem prazo. | Executar matriz controlada P19-B sob briefs por autoridade. |
| P18-DEL-05 | Audit de entrega/admin — [P12 final](p12-final-gate.md), [matriz Gate D](p17-gate-d-evidence-matrix.md) | `DigitalDeliveryEvent` hospedado; AdminAudit UI/RBAC e empty state comprovados. | hosted/staging + local | PASS / HOSTED PROVEN | Escrita AdminAudit não foi exercitada no P17-A09; B06 continua não executado. | Sem audit fail-closed não há recuperação segura. | Não definido; sem prazo. | Manter distinção e provar B06 antes de liberar recovery. |

### 4.6 Backup, restore, RPO/RTO, retenção e rollback

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-BCP-01 | Recovery unit v2 — [P16-08](p16-backup-recovery-candidate.md) | Dump guardado, AES-256-GCM, HMAC, HKDF, manifest/release/migrations/artifacts verificados. | local/isolated + hosted mechanism | PASS / HOSTED PROVEN | Custódia/chaves e execução production não verificadas. | Sem unidade válida, restore não é confiável. | Não definido; sem prazo. | Reusar contrato em plano P19-A; não gerar backup nesta etapa. |
| P18-BCP-02 | RPO ≤ 24 h — [P16-09](p16-final-technical-gate.md) | Scheduler real final, correlação independente e RPO de 888 ms em `22fad0f…`. | independently correlated | PASS / HOSTED PROVEN | Uma janela histórica 13:17 segue sem RPO individual; prova limitada à release/execução P16. | Objetivo staging provado, não garantia produtiva contínua. | Não definido; sem prazo. | Definir evidência recorrente e verificar production antes de GO. |
| P18-BCP-03 | RTO ≤ 8 h — [P16-08](p16-backup-recovery-candidate.md) | Recovery isolado controlado em 540395 ms com DB/R2/grants/readiness/smoke. | hosted/staging recovery | PASS / HOSTED PROVEN | Não é restore de primary nem prova production. | Demonstra mecanismo, não autorização de disaster recovery produtivo. | Não definido; sem prazo. | Planejar drill production-safe com autorização futura. |
| P18-BCP-04 | Retenção 7/4/3 — [P16-08](p16-backup-recovery-candidate.md) | Planner determinístico e lock passam; nenhuma deleção/lifecycle executado. | local/static | PROVISIONAL / DIAGNOSTIC ONLY | `PLAN_ONLY`; cobertura histórica real 7/4/3 não comprovada. | Sem retenção efetiva, pontos podem faltar ou crescer indefinidamente. | Não definido; sem prazo. | Projetar política/lifecycle e aprovação de deleção separada. |
| P18-BCP-05 | Cópia independente off-R2 — [P16-08](p16-backup-recovery-candidate.md) | Mecanismo Google Drive provado para bundle anterior; ponto final não possui cópia independente provada. | hosted mechanism | PENDING_EXTERNAL / NOT_EXECUTED | Último recovery point permanece no mesmo domínio relevante. | Falha Cloudflare pode atingir origem e cópia. | Não definido; sem prazo. | Criar e verificar cópia cifrada do ponto de release sob autoridade futura. |
| P18-BCP-06 | Consistência DB/R2 — [P16-08](p16-backup-recovery-candidate.md) | Um recovery unit associa os dois captures. | hosted mechanism | PROVISIONAL / DIAGNOSTIC ONLY | Captura sequencial, não snapshot atômico cross-system. | Pode haver janela de inconsistência lógica. | Não definido; sem prazo. | Definir quiescence/consistency protocol e critérios de reconciliação. |
| P18-BCP-07 | Restore/rollback separados — [P16-08](p16-backup-recovery-candidate.md) | Restore isolado e rollback de app têm gates/proveniência separados. | local + hosted/staging | PASS / HOSTED PROVEN | Nenhum rollback/restore produtivo autorizado; compatibilidade P17 não reavaliada. | Evita tratar troca de artefato como recuperação de dados. | Não definido; sem prazo. | Preparar runbook P19-A vinculado à release final. |

### 4.7 Observabilidade, incidentes, domínio e suporte

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-OBS-01 | Correlação, logs, métricas e spans — [P15](p15-final-gate.md) | Correlação server-authoritative, labels fechados e spans locais; Gate C PASS. | local/isolated | PASS / LOCAL TEST PROVEN | Não há claim de tracing distribuído; retention/coleta production não verificadas. | Diagnóstico produtivo pode ser incompleto. | Owners abstratos P15; prazo não definido. | Mapear destino e retenção production em P19-A. |
| P18-OBS-02 | Liveness/readiness externo — [arquitetura P16](../architecture/p16-staging-deployment-architecture.md) | Better Stack health, Grafana readiness protegido, alert e e-mail exercitados. | hosted/staging | PASS / HOSTED PROVEN | Token staging deve ser rotacionado antes de produção; monitors production não existem/provados. | Sem monitor externo, incidentes podem não ser detectados. | Não definido; antes de P19-C. | Preparar provisionamento/rotação/checks sob brief futuro. |
| P18-OBS-03 | Status público — [arquitetura P16](../architecture/p16-staging-deployment-architecture.md) | `status.lessenc.com.br` HTTPS com componente Website apoiado no monitor real. | hosted/staging | PASS / HOSTED PROVEN | Checkout/Payments/Buyer/Admin não podem ser publicados sem sinais reais; SLOs `OPEN_STAGING_BASELINE`. | Status incompleto pode induzir comunicação incorreta. | Não definido; sem prazo. | Definir componentes/SLOs somente com telemetry verificável. |
| P18-OPS-01 | Runbooks de incidentes — [P15 runbook](p15-incident-response-runbook.md) | Nove classes, severidade, lifecycle, rollback/recovery separados e regras de não exposição. | Git/documental + local | PASS / DOCUMENTARY PROVEN | Escala/on-call/canais production e exercício final não documentados como provados. | Resposta pode atrasar ou depender de uma pessoa. | Owners abstratos P15; prazo não definido. | Preparar RACI/contatos/escalation e tabletop em P19-A. |
| P18-NET-01 | Domínio/HTTPS staging — [P16-07](../security/p16-hosted-security-validation.md) | `lessenc.com.br` e status subdomain validados em staging. | hosted/staging | PASS / HOSTED PROVEN | O hostname de staging não converte o ambiente em produção; estado atual pode derivar. | Não prova readiness do domínio produtivo. | Não definido; sem prazo. | Revalidar DNS/TLS/redirect/headers na release autorizada. |
| P18-NET-02 | Ambiente/domínio production — `ROADMAP.md` P18/P19 | Nenhum deploy, DNS switch ou validação production. | none | PRODUCTION NOT VERIFIED | Configuração, domínio, certificado, edge e rollback production ausentes. | Gate E/P19-C blocker. | Owner; sem prazo. | Preparação documental P19-A; execução só após GO e autorização. |

### 4.8 Analytics, consentimento, responsividade e performance

| ID | Controle e fonte canônica | Evidência disponível | Camada | Estado | Risco residual / pendência | Impacto produtivo | Responsável / prazo documentado | Próxima ação autorizável |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P18-ANA-01 | Consentimento first-party e provider dispatch — [P13-H](p13-h-final-gate.md), [P16-07](../security/p16-hosted-security-validation.md) | Consent endpoint fechado/same-origin; UNKNOWN não vira GRANTED; adapters locais testados. | local/isolated + hosted negative | PASS / LOCAL TEST PROVEN | Recebimento live de providers e configuração production não validados. | Coleta indevida ou telemetria ausente. | Não definido; sem prazo. | Revisar configuração e política antes de ativar providers. |
| P18-ANA-02 | Receita/analytics administrativo — [P13-G](p13-g-final-gate.md) | Purchase canônico, agregados read-only, OWNER/ADMIN permitido e SUPPORT negado. | local/isolated | PASS / LOCAL TEST PROVEN | Produção e dados reais não verificados. | Evita autoridade financeira por analytics externo. | Não definido; sem prazo. | Preservar projeção canônica; validar read-only em release autorizada. |
| P18-ANA-03 | Meta CAPI/matching data — [P13-H](p13-h-final-gate.md) | Implementação técnica concluída, mas `MATCHING_DATA_POLICY_NOT_AUTHORIZED / PRIVACY_POLICY`. | Git/documental + local | BLOCKED / DEFERRED | Política não autoriza live transport, `_fbp`, `_fbc` ou matching expansion. | Não pode ser ativado em produção. | Não definido; sem prazo. | Manter desabilitado até decisão de privacidade explícita. |
| P18-ANA-04 | GTM/Meta browser no hosted P17 — [matriz Gate D](p17-gate-d-evidence-matrix.md) | Ausência de IDs/scripts/requests tornou P05/P06 NOT_APPLICABLE na release histórica. | hosted/staging | PASS / HOSTED PROVEN | Estado não prova configuração futura/production. | Ativação sem consentimento/revisão é risco de privacidade. | Não definido; sem prazo. | Revalidar apenas se configuração for autorizada. |
| P18-UX-01 | Payment Brick nos três viewports — P17-R01–R03 na [matriz Gate D](p17-gate-d-evidence-matrix.md) | Superfícies gerais responsivas; Brick real não provado em mobile/tablet/desktop. | partial hosted | BLOCKED / DEFERRED | Três cenários obrigatórios pendentes. | Gate D blocker e risco de checkout inutilizável. | Não definido; sem prazo. | Executar Brick TEST real em três viewports sob brief específico. |
| P18-PERF-01 | PR01–PR04 — [matriz Gate D](p17-gate-d-evidence-matrix.md), [relatório local](p17-local-validation-report.md) | 15 cohorts/45 warmups/600 amostras dentro dos budgets no capsule final; commit identity incompleta. | local/isolated | PROVISIONAL / DIAGNOSTIC ONLY | Pacote é `PROVISIONAL_LOCAL_NUMERIC_REVIEW_ONLY`; aceite definitivo deferred. | Gate D blocker; performance hospedada/authority ausente. | Owner aprovou budget; prazo não definido. | Reconciliar provenance/authority e executar aceite definitivo sem repetir trabalho comprovado desnecessariamente. |

## 5. Pendências P17 herdadas — transporte integral

| ID | Requisito | Estado preservado | Evidência faltante | Consequência |
| --- | --- | --- | --- | --- |
| P17-E05 | Webhook Mercado Pago TEST real autenticado | BLOCKED / DEFERRED | Entrega real autenticada e correlação provider/hosted/DB; `HMAC_MISMATCH / NEITHER_MATCH` não é prova. | Gate D blocker. |
| P17-F01 | Pagamento recusado real | PENDING_EXTERNAL / DEFERRED | Resultado provider TEST e ausência segura de entitlement/fulfillment. | Gate D blocker. |
| P17-B01 | Credencial Buyer inválida | PENDING_EXTERNAL / DEFERRED | Evidência externa/hosted aplicável. | Gate D blocker. |
| P17-B03 | Buyer rate limit | NOT_EXECUTED / DEFERRED | Execução controlada e efeitos fail-closed. | Bloqueador residual obrigatório. |
| P17-B04 | Storage indisponível | NOT_EXECUTED / DEFERRED | Negação segura sem alterar direito comercial. | Gate D blocker. |
| P17-B05 | Falha de stream | NOT_EXECUTED / DEFERRED | Interrupção, cleanup e audit sem vazamento. | Bloqueador residual obrigatório. |
| P17-B06 | Falha de delivery audit | NOT_EXECUTED / DEFERRED | Prova de que bytes não são liberados quando audit obrigatório falha. | Gate D blocker. |
| P17-B07 | Recovery | NOT_EXECUTED / DEFERRED | Recovery/reissue atômico, auditável e autorizado. | Gate D blocker. |
| P17-R01 | Payment Brick real — mobile | PENDING_EXTERNAL / DEFERRED | Execução funcional real no viewport aprovado. | Gate D blocker. |
| P17-R02 | Payment Brick real — tablet | PENDING_EXTERNAL / DEFERRED | Execução funcional real no viewport aprovado. | Gate D blocker. |
| P17-R03 | Payment Brick real — desktop | PENDING_EXTERNAL / DEFERRED | Execução funcional real no viewport aprovado. | Gate D blocker. |
| P17-PR01 | Public navigation | PROVISIONAL / DEFERRED | Aceite definitivo com provenance/authority reconciliadas. | Gate D blocker. |
| P17-PR02 | Checkout interaction | PROVISIONAL / DEFERRED | Aceite definitivo com provenance/authority reconciliadas. | Gate D blocker. |
| P17-PR03 | Payment initiation | PROVISIONAL / DEFERRED | Aceite definitivo com provenance/authority reconciliadas. | Gate D blocker. |
| P17-PR04 | Buyer delivery start | PROVISIONAL / DEFERRED | Aceite definitivo com provenance/authority reconciliadas. | Gate D blocker. |

Os PASS históricos da matriz Gate D permanecem válidos em seus escopos originais. Eles não devem ser
reexecutados sem justificativa técnica, drift de release/configuração ou requisito de correlação.

## 6. Síntese de prontidão

- **Comprovado em staging/escopo histórico:** segurança HTTP/TLS, runtime DB e grants P16,
  private R2/readiness, observabilidade externa básica, backup/RPO/RTO P16, happy path comercial,
  protected delivery e administração P17.
- **Comprovado apenas localmente:** invariantes financeiras, falhas F02–F08, migrations F06,
  política de autenticação/RBAC, analytics/consent e pacote numérico de performance.
- **Provisório/diagnóstico:** retenção 7/4/3, consistência sequencial DB/R2 e performance P17.
- **Bloqueado/deferred:** E05, B01/B03–B07, R01–R03, PR01–PR04, recovery administrativo e
  `LES-SEC-RA-001`; F01 permanece pendente externo.
- **Produção não verificada:** release, ambiente, banco, storage, segredos, DNS/TLS, monitors,
  backup/restore, payment PROD, webhook PROD e smoke/rollback produtivos.

Conclusão deste inventário:

`P18-01 = PREPARATORY CANDIDATE / AWAITING INDEPENDENT RE-REVIEW`

Essa classificação não altera Gate D, Gate E ou a proibição de produção.

Uma eventual P18-02 permanece limitada à revisão documental e técnica não mutativa deste pacote.
Atestações externas, consultas privadas a provider/hosting/banco e inspeções de configuração efetiva
dependem de novo brief e autorização específica. As remediações herdadas da P17 permanecem destinadas
à P19-B e não são antecipadas pela revisão P18-02.
