# P18-05 — Security, Privacy & Compliance Readiness R01

**Data:** 18/10/2026

**Release técnica:** `a780faa6d9275b1f9abfae2ad812aa0a2d78402a`

**Estado:** `TECHNICAL REVIEW COMPLETE / EXTERNAL AND LEGAL ASSURANCE PENDING`

## Resultado executivo

`LES-SEC-RA-001` foi tecnicamente remediado por patch mantido, hash-pinned e verificado em CI. O
grafo completo auditado tem zero findings e o pacote não aparece no grafo runtime. Essa correção
remove apenas o hard stop específico; não concede Gate D, Gate E ou produção.

A revisão de segurança restante não identificou justificativa para alterar auth, pagamentos,
webhooks, storage ou schema. Os controles existentes permanecem fail-closed. Evidência production,
decisão jurídica LGPD e provider-private continuam fora da autoridade demonstrada.

## Superfícies revisadas

| Superfície | Resultado | Evidência e limite |
| --- | --- | --- |
| admin auth/MFA/session/recovery | PARTIALLY PROVEN | auth/MFA/RBAC regressions passam; recovery administrativo continua bloqueado sem reissue/audit atômico |
| RBAC/server-side authorization | PROVEN LOCAL + HISTORICAL HOSTED | nenhuma autorização client-side foi introduzida; production não verificada |
| XSS/CSP | PARTIALLY PROVEN | encoding/framework e CSP existem; `unsafe-inline` script MEDIUM/style LOW permanecem |
| CSRF | PROVEN LOCAL | same-origin/origin checks, cookies e rotas mutáveis cobertos; production não verificada |
| SSRF/open redirect | PROVEN LOCAL | allowlists/URLs canônicas e validação server-side preservadas |
| SQL injection | PROVEN LOCAL | Prisma/queries parametrizadas; nenhum SQL dinâmico novo |
| IDOR | PROVEN LOCAL | Buyer/entitlement/resource authorization server-side; B01/B03–B07 externos pendentes |
| HTTPS/cookies/headers | HISTORICAL HOSTED PROVEN | P16/staging; revalidação temporal da RC/production necessária |
| secrets | PROVEN REPOSITORY / PRODUCTION UNKNOWN | nenhum segredo versionado; inventário/rotação production pendentes |
| rate limiting/abuse | PROVEN LOCAL | DB-backed e fail-closed; comportamento de indisponibilidade externo pendente |
| dependencies/lock/supply chain | PROVEN LOCAL + HOSTED CI | `npm ci`, audit zero, hashes, lock e CodeQL; capsule offline P17 invalidado pelo novo lock |
| logs/audit/telemetry | PROVEN LOCAL + HISTORICAL HOSTED | minimização/redação existentes; retenção/backend production não verificados |
| consent/analytics/LGPD | PARTIALLY PROVEN | consentimento first-party e minimização implementados; não constitui parecer jurídico |
| Meta CAPI | BLOCKED BY POLICY | permanece desativado; nenhum matching data enviado |
| financial integrity | PROVEN LOCAL / EXTERNAL INCOMPLETE | browser não concede PAID/APPROVED/ACTIVE; E05/F01 continuam abertos |
| webhook HMAC | BLOCKED / DEFERRED | negativos locais passam, mas entrega TEST real segue `HMAC_MISMATCH / NEITHER_MATCH` |

## LES-SEC-RA-001

Detalhes, proveniência e hashes estão em
[`les-sec-ra-001-braces-remediation.md`](../security/les-sec-ra-001-braces-remediation.md) e na
política machine-readable associada.

Evidências:

- candidato upstream fixado em `28d440b5dd449dbf1fe6f3506cf94ecca4d02660`;
- artefato `braces@3.0.4-lessenc.1` com limite de profundidade 100;
- suíte upstream: `904 passing`;
- regressões atuais: `6/6`; regressões históricas: `15/15`;
- expansão funcional e rejeição de profundidade 101 comprovadas;
- `npm audit --json`: zero em info/low/moderate/high/critical;
- `npm ls braces --omit=dev`: vazio;
- Application gates e CodeQL do PR #64: PASS;
- primeiro runner Linux falhou por hash CRLF/LF do `LICENSE`; o evaluator passou a normalizar texto
  em LF e o rerun hospedado passou. O histórico falho foi preservado.

O upstream ainda não publicou uma versão oficial corrigida na data da revisão. A L'Essenc assume a
manutenção temporária do patch, deve monitorar advisory/PR e migrar para release oficial somente
após nova auditoria e regressões. Isso é risco operacional residual, não vulnerabilidade aceita.

## Privacidade e compliance

- dados financeiros continuam server-side e dados integrais de cartão não são armazenados;
- logs e respostas usam IDs opacos e redação de campos sensíveis;
- analytics exige consentimento e o Meta CAPI permanece desativado;
- nenhuma leitura de `.env`, segredo, cookie real ou PII foi realizada nesta execução;
- nenhuma conclusão de conformidade legal certificada é emitida;
- bases legais, prazos de retenção de dados pessoais, DSR e textos finais devem receber validação
  jurídica/operacional antes de produção.

## Riscos residuais de segurança

1. `P17-E05` CRITICAL Gate D — webhook TEST real não autenticado.
2. B04/B06/B07 CRITICAL Gate D — failure/recovery/audit externos não executados.
3. CSP `unsafe-inline` — MEDIUM script e LOW style herdados.
4. Recovery admin — SAFE DEFER/BLOCKED.
5. Rotação e segregação de segredos production — obrigatórias antes de produção.
6. Branch P17 sem protection/ruleset ativo — estado atual verificado; risco de plataforma.
7. Patch mantido de `braces` — monitoramento upstream e revalidação contínua obrigatórios.

## Conclusão

`P18-05 = COMPLETE FOR TECHNICAL REVIEW / PRODUCTION SECURITY NOT VERIFIED`.

Não houve waiver, supressão artificial de audit, downgrade incompatível, bypass de HMAC/MFA/RBAC
ou alegação de conformidade legal.
