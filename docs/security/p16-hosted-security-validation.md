# P16-07 — Hosted Security Validation

**Estado:** BLOCKED — external secret rotation and hosted CSP reconciliation require owner access

**Data da validação:** 26/09/2026

**Branch:** `phase/p16-staging-deployment`

**Baseline de abertura:** `e1c65db1838417a9f945d4fe1c8061f6366afcda`

**`origin/main` preservado:** `300a5db6755b238606f0aa91e05981b2af121acc`

## Resultado

P16-07-01 a P16-07-06 foram executadas até o limite disponível por código e acesso público
read-only. Os controles de aplicação, TLS, negações hospedadas, isolamento de staging, exposição
pública e dependências passaram nas verificações executadas. A fase não pode encerrar P16-07-07
como PASS porque dois controles exigem acesso interativo externo indisponível:

1. rotacionar o `P16_READINESS_TOKEN` de staging já comprometido por exposição visual histórica e
   reconciliar atomicamente Hostinger e Grafana Cloud;
2. remover a substituição hospedada que reduz o CSP completo da aplicação a
   `upgrade-insecure-requests` e confirmar a política final na borda.

Status obrigatório:

`P16-07 / BLOCKED / EXTERNAL SECRET ROTATION REQUIRES OWNER ACTION`

P16 continua incompleta. Produção, `main`, pagamentos reais e as fases P16-08/P16-09 permanecem
fora desta execução.

## P16-07-01 — Security surface inventory

| Superfície | Método | Autoridade/controle efetivo | Negação e exposição |
| --- | --- | --- | --- |
| páginas públicas | GET | nenhuma sessão; proxy cria correlação e aquisição somente na rota comercial elegível | 404 genérico; nenhum segredo encontrado em HTML/JS |
| `/api/health` | GET | público e mínimo | `200 {"status":"ok"}`, `no-store`; sem dependências |
| `/api/readiness` | GET | bearer server-only, digest SHA-256 de tamanho fixo e `timingSafeEqual` antes das probes | ausente/inválido -> `404 {"status":"not_found"}`, `no-store`; nenhum detalhe de dependência |
| `/api/admin/auth/[...all]` | GET/POST por allowlist | allowlist exata de path/método, same-origin em POST, corpo limitado, Better Auth server-side, rate limit persistido | path/query/método inválido -> 404; origem inválida -> 403; erros sanitizados e `no-store` |
| páginas `/admin/(protected)` | GET/server actions | sessão persistida, usuário verificado, MFA completo e RBAC server-side; ações repetem permission check | sem sessão -> login; sem MFA -> enrollment; sem permissão -> 404 ou forbidden |
| `/api/analytics/consent` | GET/POST | jornada first-party; POST exige origem canônica, schema fechado e estado válido | UNKNOWN nunca vira GRANTED; entrada inválida é genérica e sem cache |
| `/checkout/payment/start` | POST | same-origin, sessão de continuação server-side, corpo limitado e método estrito | cross-origin -> 403 antes de coordenar pagamento; sem sessão -> 401 |
| `/checkout/payment/status` | POST | same-origin e sessão de continuação; autoridade financeira continua server-side | falha genérica e sem cache; resposta não cria autoridade financeira |
| `/api/webhooks/mercadopago` | POST | query exata, assinatura HMAC, request ID, janela temporal, corpo limitado e envelope consistente | assinatura inválida -> 401 antes de tocar dados; falha interna -> 503 vazio |
| `/api/buyer-access/exchange` | POST | origem canônica, credencial opaca one-time e rate limits fail-closed | erro genérico; nenhuma sessão emitida na falha |
| `/api/buyer-access/library` | GET | cookie `__Host-`, sessão HMAC e entitlement server-side | sem sessão -> 401, privado e `no-store` |
| `/api/buyer-access/resources/[resourceId]` | GET | sessão, entitlement/resource binding, rate limit e auditoria antes do primeiro byte | sem sessão -> 401; recurso não autorizado não é enumerável; storage/provider sanitizado |
| `/api/buyer-access/logout` | POST | origem canônica; expira o cookie com os mesmos atributos | cross-origin -> 403 sem mutação de cookie |

Controles classificados:

- **HOSTED PROVEN:** HTTPS redirect, TLS/hostname, cookies/redirect administrativo observáveis,
  negações de admin/readiness/webhook/buyer/payment/consent, cache de superfícies sensíveis e
  ausência dos nomes de segredos nos bundles inspecionados;
- **IMPLEMENTED + TESTED LOCALLY:** RBAC, MFA/TOTP, sessão/freshness, IDOR/entitlement,
  anti-replay do webhook, rate limits, error normalization, staging preflight e release binding;
- **PARTIAL / REQUIRES REMEDIATION:** CSP final na borda;
- **BLOCKED EXTERNALLY:** rotação do readiness e prova autenticada com o segredo substituto;
- **NOT APPLICABLE:** CORS público amplo e open redirect não são usados como mecanismos de
  autorização nas superfícies inventariadas.

## P16-07-02 — HTTPS, TLS and headers

Evidência hospedada read-only:

- `http://lessenc.com.br/` -> HTTP 301 para `https://lessenc.com.br/`;
- TLS 1.3, `TLS_AES_256_GCM_SHA384`;
- certificado `CN=lessenc.com.br`, issuer Let's Encrypt YE1, hostname válido;
- validade observada: 21/08/2026 11:33:36Z a 19/11/2026 11:33:35Z;
- verificação de cadeia pelo cliente: sucesso;
- HSTS `max-age=31536000`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- Permissions Policy bloqueia câmera, geolocation, microphone, browsing-topics e USB;
- `X-Powered-By` ausente;
- endpoints sensíveis observados retornaram `no-store`/`private` conforme o contrato.

O finding P16-07-F02 impede PASS. O `routes-manifest.json` do build staging contém o CSP completo,
incluindo `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`,
`script-src-attr 'none'`, allowlists explícitas e ausência de `unsafe-eval`. Entretanto, `/`,
`/checkout/payment`, `/admin/login` e `/api/health` devolveram na borda somente:

`Content-Security-Policy: upgrade-insecure-requests`

Isso demonstra substituição após o artefato da aplicação. Alterar o gerador de CSP para produzir o
mesmo valor novamente não corrige a camada que o sobrescreve.

Os headers `Server: hcdn`, `platform: hostinger` e `panel: hpanel` são exposição INFO controlada
pelo provedor. Nenhuma versão de Node, Next.js ou dependência foi exposta.

## P16-07-03 — Admin, auth, session, MFA and readiness

- admin sem sessão redireciona para `/admin/login`;
- path de auth fora da allowlist e query inesperada retornam 404;
- enable de TOTP sem sessão retorna 403;
- POST administrativo exige a origem pública exata e rejeita `cross-site`;
- signup está desabilitado, e-mail verificado é obrigatório e MFA não pode usar
  `trustDevice:true`/`disableSession:true`;
- cookie administrativo hosted é `__Host-lessenc_admin`, `Secure`, `HttpOnly`, `SameSite=Lax`,
  `Path=/`, sem `Domain`; sessão tem limite absoluto de 8 h, idle de 30 min e freshness de 5 min;
- RBAC e fresh-auth são avaliados no servidor; UI e respostas de provider não concedem autoridade;
- readiness sem bearer e com bearer aleatório retornou o mesmo 404 genérico, antes de executar
  dependências;
- a prova autenticada histórica P16-06 continua válida para a release então observada, mas não pode
  ser reutilizada como prova da rotação exigida por P16-07.

Nenhuma identidade OWNER foi alterada, recriada ou usada nos testes.

## P16-07-04 — Secrets, configuration and error disclosure

- único arquivo de ambiente rastreado: `.env.example`, somente com fixtures explícitas;
- `.env` e `.env.*` estão ignorados;
- nenhuma chave privada ou credencial de formato real foi encontrada no conteúdo rastreado
  inspecionado; atribuições localizadas pertencem a `.env.example` ou testes sintéticos;
- 3 páginas públicas e 10 assets JavaScript, total de 704.571 bytes, foram varridos em memória:
  zero nomes de segredo server-only, zero chave privada e zero sourcemap referenciado;
- health, readiness, admin, buyer access, webhook e pagamentos retornam respostas sanitizadas;
- logger possui redaction estrutural para authorization, cookie, set-cookie, tokens e secrets;
- correlation IDs são opacos e não carregam identidade ou segredo;
- o token historicamente exibido não foi recuperado, lido, repetido ou escrito nesta execução.

## P16-07-05 — Staging isolation

O contrato executável exige fail-closed:

- `APP_ENV=staging`, `NODE_ENV=production`, `APP_URL=https://lessenc.com.br`;
- `P16_STAGING_ENVIRONMENT_ID=lessenc-staging`;
- Mercado Pago atestado como `test`, com credenciais no formato esperado;
- `P16_DATABASE_MIGRATION_WINDOW=disabled` no runtime;
- banco remoto com nome inequivocamente staging, TLS e CA absoluta;
- modelo Hostinger single-user somente quando explicitamente declarado;
- storage `hosted`/R2, endpoint HTTPS canônico, bucket configurado e sentinel fixa;
- todos os segredos mínimos, fortes e distintos;
- `P16_RELEASE_COMMIT` de 40 hex e igual ao `HEAD` para operações protegidas;
- nenhuma autoridade local/localhost, filesystem privado ou fallback de produção aceita pelo
  preflight hosted.

Os testes de contrato cobrem rejeição de produção/local, credencial compartilhada, migration
window indevida, banco divergente, TLS inválido, R2 drift, segredo fraco/reutilizado e release
divergente. P16-06 provou essa configuração no deploy então validado. O acesso público P16-07 não
expõe valores que permitam reatestar cada variável atual; a reconciliação final deve ocorrer no
hPanel ao aplicar a rotação.

## P16-07-06 — Controlled negative validation

| Caso hospedado | Resultado |
| --- | --- |
| admin sem sessão | 307 para `/admin/login` |
| auth path fora da allowlist | 404, `no-store` |
| auth com query inesperada | 404, `no-store` |
| enable MFA sem sessão | 403, `no-store` |
| readiness sem bearer | 404, `no-store` |
| readiness com bearer aleatório | 404, `no-store` |
| webhook com assinatura inválida | 401, `no-store` |
| buyer exchange cross-origin | 403, private/no-store |
| buyer logout cross-origin | 403, private/no-store, sem expirar cookie |
| payment start cross-origin | 403, private/no-store, antes de criar pagamento |
| consent cross-origin | 403, no-store |
| buyer library sem sessão | 401, private/no-store |
| path inexistente | 404 sanitizado, private/no-cache/no-store |

Replay/timestamp, falhas internas, rate limits e IDOR foram exercitados apenas nos testes locais
determinísticos para não gerar lockout, carga, pagamento ou mutação hosted. Não houve brute force,
flood, entitlement real, pagamento ou transação comercial.

## Findings register

### P16-07-F01 — Exposed staging readiness credential

- **Severity:** HIGH
- **Surface:** Hostinger environment / Grafana Synthetic Monitoring
- **Evidence:** exposição visual histórica declarada pelo owner; valor não recuperado nesta fase
- **Risk:** terceiro que reteve a captura pode consultar readiness sanitizado e consumir probes
- **Root cause:** segredo apareceu em uma captura de tela de configuração
- **Remediation:** gerar valor CSPRNG novo, atualizar Hostinger e Grafana, verificar o novo valor e
  invalidar o anterior
- **Regression:** bearer ausente/aleatório continua 404; novo bearer deve retornar somente
  `ready`/`not_ready` e `no-store`
- **Hosted validation:** pendente por falta de acesso interativo aos dois secret stores
- **Final status:** BLOCKED

### P16-07-F02 — Hosted CSP replaced by upgrade-only policy

- **Severity:** MEDIUM
- **Surface:** Hostinger response layer/CDN
- **Evidence:** quatro superfícies hosted retornam somente `upgrade-insecure-requests`; o artefato
  Next contém a política completa
- **Risk:** o browser perde as restrições CSP planejadas para script, object, base, form, frame,
  worker e conexões; `X-Frame-Options: DENY` ainda mitiga framing
- **Root cause:** override externo compatível com regra Hostinger/Apache
  `Header always set Content-Security-Policy: upgrade-insecure-requests`
- **Remediation:** remover somente o override externo e deixar o header da aplicação atravessar a
  borda; se a linha não existir, abrir chamado Hostinger com request ID
- **Regression:** exigir CSP completo em `/`, `/checkout/payment`, `/admin/login`, `/api/health` e
  uma resposta 4xx; checkout mantém somente a exceção `frame-src https:` necessária ao 3DS
- **Hosted validation:** pendente por falta de hPanel/File Manager
- **Final status:** BLOCKED

### P16-07-F03 — Provider banner headers

- **Severity:** INFO
- **Surface:** Hostinger CDN
- **Evidence:** `Server: hcdn`, `platform: hostinger`, `panel: hpanel`
- **Risk:** fingerprint genérico do provedor, sem versão de runtime/framework
- **Root cause:** borda gerenciada
- **Remediation:** nenhuma mudança de aplicação; consultar suporte apenas se houver opção suportada
- **Regression:** `X-Powered-By` deve permanecer ausente
- **Hosted validation:** observado
- **Final status:** ACCEPTED / INFO

### P16-07-F04 — Application security boundaries

- **Severity:** PASS
- **Surface:** auth, admin, readiness, webhook, payments, buyer access and consent
- **Evidence:** inspeção de implementação, 78 testes focados, suíte completa de 888 testes e
  negativos hosted acima
- **Risk:** nenhum finding aberto adicional nas verificações executadas
- **Root cause/remediation:** não aplicável
- **Regression:** suíte de segurança e quality gate completos
- **Hosted validation:** negações read-only observadas
- **Final status:** PASS

## Owner actions required to unblock

Executar em uma única janela curta, sem publicar o valor em chat, screenshot, log ou Git:

1. gerar localmente um novo segredo aleatório de pelo menos 32 bytes; manter o valor apenas em
   memória/clipboard seguro;
2. em Hostinger: **Websites -> Dashboard** do app Node.js -> **Environment variables** -> editar
   `P16_READINESS_TOKEN` -> **Apply changes**;
3. em Grafana Cloud: **Testing & synthetics -> Synthetics -> Config -> Secrets** -> editar
   `p16-readiness-token` -> substituir pelo mesmo valor -> **Save**;
4. confirmar que o check `lessenc-protected-readiness` usa a referência secreta, nunca um header
   literal, e aguardar uma execução verde;
5. confirmar externamente: sem bearer e bearer aleatório -> 404; novo bearer -> 200 `ready` ou 503
   `not_ready`, sempre `no-store`; testar o antigo somente em cliente local que não registre o
   valor e confirmar 404;
6. limpar imediatamente clipboard e qualquer arquivo temporário.

Para o CSP:

1. em Hostinger: **Websites -> Dashboard -> File Manager**;
2. abrir `public_html/.htaccess` e preservar todas as regras de roteamento Node.js;
3. se existir, remover somente
   `Header always set Content-Security-Policy: upgrade-insecure-requests`;
4. salvar e usar **Performance -> CDN -> Flush cache**;
5. verificar novamente os cinco caminhos indicados no finding F02;
6. se a linha não existir ou a borda continuar substituindo o header, abrir chamado Hostinger com
   domínio, horário UTC, path e `x-hcdn-request-id`, pedindo preservação do CSP originado pelo app.

Não desabilitar o CDN, não alterar DNS e não enfraquecer o CSP como atalho.

## P16-07-07 — Closeout boundary

O repositório registra a verdade atual e preserva os findings. O closeout final precisa de evidência
hosted posterior às duas ações externas, reexecução do gate focado, reconciliação do deploy e um
novo commit documental. Até lá:

Quality gate executado:

- testes focados: 11 arquivos / 78 testes PASS;
- primeira tentativa de `npm run check`: FAIL de harness porque `APP_ENV` estava ausente; o parser
  recusou a configuração e o logger usou `unknown`, sem indicar regressão de código;
- `APP_ENV=test npm run check`: PASS — lint sem warnings, Prisma generate, typecheck, 99 arquivos /
  888 testes e Prettier;
- build Next.js staging/production com configuração integralmente sintética: PASS, 11 páginas
  estáticas e todas as rotas dinâmicas compiladas;
- 22 arquivos do bundle estático recém-gerado: zero nome/fixture server-only; manifest confirma CSP
  global com `default-src 'self'`/`object-src 'none'`, sem `unsafe-eval`, e exceção 3DS apenas no
  checkout;
- `npm audit`: 0 vulnerabilidades;
- `git diff --check`: PASS.

`P16-07 BLOCKED / EXTERNAL SECRET ROTATION AND HOSTED CSP RECONCILIATION REQUIRE OWNER ACTION`
