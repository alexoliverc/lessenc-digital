# P16-07 — Hosted Security Validation

**Estado:** P16-07 COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED

**Datas da validação:** 26–27/09/2026

**Branch:** `phase/p16-staging-deployment`

**Baseline da reconciliação final:** `50601497899d11bd8fc01a4ae51fcb8402fe13c0`

**`origin/main` preservado:** `300a5db6755b238606f0aa91e05981b2af121acc`

## Resultado

P16-07-01 a P16-07-07 estão concluídas. Os dois findings externos preservados abaixo foram
remediados e revalidados: o readiness token historicamente exposto foi rotacionado de forma
coordenada na Hostinger e no Grafana, e a aplicação voltou a ser a autoridade única do CSP após a
remoção do override de Force HTTPS. TLS, headers, negações, isolamento de staging, bundles públicos,
dependências e gates completos passaram.

`P16-07 COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED`

P16 continua incompleta. Produção e `main` permanecem fora desta execução; P16-08 continua isolada
e ainda não integrada, e P16-09 não foi iniciada.

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
- **HOSTED REMEDIATED + PROVEN:** CSP completo no origin e edge, com exatamente um header por
  resposta, e rotação coordenada do readiness confirmada pelo owner;
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

Na condição histórica de 26/09, a borda substituía o CSP completo por apenas
`upgrade-insecure-requests`. O suporte Hostinger confirmou Force HTTPS como causa. O owner preservou
SSL, CDN, DNS e as regras Passenger/Node, inseriu o redirect HTTP -> HTTPS no início do `.htaccess`,
não adicionou CSP ao arquivo e desabilitou Force HTTPS. Na revalidação de 27/09, origin direto e
edge retornaram HTTP 200 e exatamente um CSP completo em `/`, `/checkout/payment`, `/admin/login`,
`/api/health` e 404 seguro. A raiz restringe `frame-src` aos hosts Mercado Pago; somente o checkout
usa `frame-src https:` para o 3DS. O CSP continua pertencendo à aplicação.

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
- o owner confirmou a troca atômica do segredo nos dois stores e o check recorrente
  `lessenc-protected-readiness` verde, com uptime e reachability em 100%; a API Hostinger confirmou
  apenas a presença mascarada de `P16_READINESS_TOKEN`, sem revelar seu valor;
- a reconciliação independente manteve readiness sem bearer e com bearer sintético inválido em 404
  genérico/no-store. O segredo anterior ou atual não foi recuperado, impresso ou persistido.

Nenhuma identidade OWNER foi alterada, recriada ou usada nos testes.

## P16-07-04 — Secrets, configuration and error disclosure

- único arquivo de ambiente rastreado: `.env.example`, somente com fixtures explícitas;
- `.env` e `.env.*` estão ignorados;
- nenhuma chave privada ou credencial de formato real foi encontrada no conteúdo rastreado
  inspecionado; atribuições localizadas pertencem a `.env.example` ou testes sintéticos;
- na reconciliação final, 3 páginas públicas e 10 assets JavaScript, total de 656.070 bytes de JS,
  foram varridos em memória:
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
divergente. Na reconciliação final, a API Hostinger confirmou a presença das 27 chaves exigidas,
sempre com valores mascarados; o build Node.js concluído estava ligado à branch canônica e ao commit
`50601497899d11bd8fc01a4ae51fcb8402fe13c0`. O gate focado de staging passou em 2 arquivos / 25
testes. A prova P16-06 dos valores efetivos permanece válida por continuidade, exceto o readiness
token, que foi substituído e revalidado pelo monitor recorrente.

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
- **Hosted validation:** presença mascarada na Hostinger, negações independentes e monitor Grafana
  recorrente verde após a rotação coordenada
- **Final status:** REMEDIATED / PASS

### P16-07-F02 — Hosted CSP replaced by upgrade-only policy

- **Severity:** MEDIUM
- **Surface:** Hostinger response layer/CDN
- **Historical evidence:** quatro superfícies hosted retornavam somente
  `upgrade-insecure-requests`; o artefato Next continha a política completa
- **Risk:** o browser perde as restrições CSP planejadas para script, object, base, form, frame,
  worker e conexões; `X-Frame-Options: DENY` ainda mitiga framing
- **Root cause:** Hostinger Force HTTPS inseria no servidor
  `Content-Security-Policy: upgrade-insecure-requests` e substituía a política da aplicação
- **Remediation:** preservar SSL/CDN/DNS e o routing Passenger/Node, manter redirect 301 manual no
  `.htaccess`, desabilitar Force HTTPS e deixar o CSP exclusivamente com a aplicação
- **Regression:** exigir CSP completo em `/`, `/checkout/payment`, `/admin/login`, `/api/health` e
  uma resposta 4xx; checkout mantém somente a exceção `frame-src https:` necessária ao 3DS
- **Hosted validation:** origin direto e edge retornaram uma única política completa em todas as
  superfícies, com HSTS; redirect HTTP -> HTTPS permaneceu funcional
- **Final status:** REMEDIATED / PASS

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

## Remediações externas concluídas

- F01: novo valor CSPRNG foi aplicado em Hostinger e Grafana sem impressão; o monitor recorrente
  voltou a verde. O valor permanece irrecuperável pela API, que o apresenta somente mascarado.
- F02: o owner preservou as regras Passenger/Node e adicionou no início de `public_html/.htaccess`
  o redirect 301 condicionado a HTTP; não adicionou CSP ao arquivo; preservou SSL/CDN/DNS e
  desabilitou Force HTTPS. O CSP completo voltou a atravessar origin e edge.

O `.htaccess` é estado hospedado gerenciado em parte pelo provider e não é governado pelo Git deste
repositório. Como um redeploy Node.js pode regenerá-lo ou alterá-lo, todo deploy futuro deve testar
funcionalmente o redirect HTTP -> HTTPS. CSP estático global não deve ser movido para `.htaccess`,
pois a aplicação mantém política route-sensitive para o checkout.

## P16-07-07 — Closeout boundary

O repositório preserva os findings históricos e registra a revalidação hospedada posterior às duas
ações externas. Nenhum teste destrutivo, brute force, pagamento real, mutação de OWNER ou de
entitlement foi realizado.

Quality gate executado:

- testes focados: 11 arquivos / 78 testes PASS;
- `APP_ENV=test npm run check`: PASS — lint sem warnings, Prisma generate, typecheck, 99 arquivos /
  888 testes e Prettier;
- build Next.js staging/production com configuração integralmente sintética: PASS, 11 páginas
  estáticas e todas as rotas dinâmicas compiladas;
- gate adicional de isolamento: 2 arquivos / 25 testes PASS;
- bundles públicos hosted: 3 páginas / 10 assets / 656.070 bytes de JS, sem nome server-only,
  chave privada ou sourcemap;
- `npm audit`: 0 vulnerabilidades;
- `git diff --check`: PASS.

`P16-07 COMPLETE / PASS / DOCUMENTED / HOSTED VALIDATED`
