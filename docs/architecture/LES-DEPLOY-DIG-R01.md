# LES-DEPLOY-DIG-R01 — Deploy, Ambientes e Operação da L'Essenc Digital

**STATUS: HISTORICAL / SUPERSEDED.** As definições anteriores de ambientes, `pnpm` e lockfile não são autoritativas para a meta P04; consulte [docs/README.md](../README.md), [ambientes P04](configuration-environment-system.md) e [toolchain P04](runtime-toolchain-baseline.md). Os comandos pnpm ainda descrevem o scaffold físico existente até reconciliação autorizada.

> **Baseline histórica MVP-ARCH-01:** as referências a `pnpm` e aos três ambientes correspondem à revisão anterior. A decisão posterior LES-DIG P04 especifica `npm`/`package-lock.json` e LOCAL, TEST, STAGING, PRODUCTION; consulte [implantação atual](deployment-architecture.md) e [toolchain P04](runtime-toolchain-baseline.md). Nenhuma migração física ocorreu.

**Projeto:** L'Essenc Digital
**Documento:** LES-DEPLOY-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento define a estratégia de:

- ambientes;
- build;
- deploy;
- infraestrutura;
- banco de dados;
- migrations;
- configuração;
- segredos;
- domínio;
- DNS;
- HTTPS;
- rollback;
- backups;
- restauração;
- health checks;
- operação;
- go-live;

da L'Essenc Digital.

O objetivo é permitir que uma versão aprovada saia do repositório Git e chegue à produção de forma:

```text
controlada
repetível
auditável
reversível
segura
```

---

## 2. Princípio central

Deploy não será tratado como simples:

```text
copiar arquivos
→ servidor
```

O modelo será:

```text
Código aprovado
      ↓
Checks
      ↓
Build reproduzível
      ↓
Configuração de ambiente
      ↓
Migration controlada
      ↓
Deploy
      ↓
Health checks
      ↓
Smoke tests
      ↓
Monitoramento
```

---

## 3. Infraestrutura inicial

A infraestrutura inicial de produção será:

```text
Hostinger Cloud Startup
+
Node.js Web App gerenciada
```

para executar a aplicação Next.js da L'Essenc Digital.

A escolha prioriza:

- simplicidade operacional;
- menor necessidade de administrar servidor;
- integração com GitHub;
- suporte a Node.js;
- suporte a Next.js;
- variáveis de ambiente;
- runtime gerenciado;
- SSL;
- backups;
- capacidade suficiente para o MVP.

---

## 4. VPS

VPS não será a opção inicial.

Um VPS poderá ser considerado futuramente se houver necessidade real de:

```text
controle de sistema operacional
Docker complexo
serviços auxiliares próprios
workers permanentes especiais
infraestrutura customizada
storage próprio
maior isolamento
requisitos de performance específicos
```

A migração para VPS não deverá exigir reescrita do domínio da aplicação.

---

## 5. Baixo acoplamento

A aplicação não deverá depender de APIs proprietárias da Hostinger para regras de negócio.

A dependência do ambiente deverá permanecer majoritariamente em:

```text
runtime Node.js
variáveis de ambiente
banco relacional
filesystem/storage abstraído
rede HTTP
```

Isso preserva portabilidade futura.

---

## 6. Ambientes

Serão reconhecidos três ambientes:

```text
LOCAL
TEST
PRODUCTION
```

---

## 7. Ambiente LOCAL

Utilizado no computador de desenvolvimento.

Características:

```text
Windows
PowerShell
VS Code
Codex
Node.js
pnpm
banco local/de desenvolvimento
credenciais de teste
```

Nenhuma credencial de produção deverá ser necessária para desenvolvimento comum.

---

## 8. Ambiente TEST

Utilizado para:

- integração;
- testes de pagamento;
- webhooks;
- migrations;
- segurança;
- smoke tests;
- validação pré-produção.

Deverá utilizar:

```text
banco separado
credenciais separadas
Mercado Pago de teste
storage separado
configuração separada
```

---

## 9. Ambiente PRODUCTION

Utilizado exclusivamente para tráfego real.

Características:

```text
NODE_ENV=production
credenciais reais
banco real
Mercado Pago produção
domínio oficial
HTTPS
logs de produção
backups ativos
monitoramento
```

---

## 10. Isolamento

É proibido compartilhar entre TEST e PRODUCTION:

```text
DATABASE_URL
Mercado Pago Access Token
Webhook Secret
storage
session secret
dados de clientes
```

---

## 11. Runtime

A aplicação utilizará:

```text
Node.js 24.x
```

como linha principal inicial, desde que suportada pelo ambiente de produção.

Desenvolvimento e produção deverão permanecer na mesma major version sempre que possível.

---

## 12. Package manager

O package manager oficial permanecerá:

```text
pnpm
```

controlado pelo campo:

```text
packageManager
```

do `package.json`.

O lockfile será obrigatório.

---

## 13. Instalação reproduzível

CI e produção deverão utilizar instalação baseada no lockfile.

Direção:

```text
pnpm install --frozen-lockfile
```

ou mecanismo equivalente suportado pela plataforma.

Mudanças de dependências exigem atualização explícita do lockfile.

---

## 14. Build

Build oficial:

```text
pnpm build
```

O build deverá falhar se existirem erros críticos de compilação.

---

## 15. Quality gates

Antes de uma versão tornar-se candidata a produção deverão passar:

```text
lint
typecheck
tests
build
security checks aplicáveis
```

A lista poderá evoluir conforme a implementação.

---

## 16. Build ≠ runtime

Segredos necessários apenas em runtime não deverão ser incorporados ao bundle público.

Variáveis expostas ao browser deverão ser explicitamente classificadas como públicas.

---

## 17. Repositório de origem

O código fonte oficial permanecerá no GitHub:

```text
alexoliverc/lessenc-digital
```

Repositorio privado.

---

## 18. Branch principal

A branch:

```text
main
```

representará código aprovado para integração/produção.

Branches de trabalho não serão utilizadas diretamente como produção.

---

## 19. Fluxo de desenvolvimento

Fluxo:

```text
branch de fase/feature
       ↓
desenvolvimento
       ↓
checks
       ↓
commit
       ↓
push autorizado
       ↓
Pull Request
       ↓
revisão
       ↓
merge em main
       ↓
candidato a deploy
```

---

## 20. Branch de produção

Produção deverá apontar para:

```text
main
```

ou futuramente para release/tag explicitamente aprovado.

Nunca para:

```text
feat/*
fix/*
phase/*
```

---

## 21. Integração GitHub → Hostinger

A aplicação Hostinger será vinculada ao repositório GitHub.

O GitHub será fonte de código do deploy.

Credenciais de GitHub não deverão ser armazenadas dentro do projeto.

---

## 22. Deploy automático

Embora a plataforma de hospedagem permita automação, o MVP deverá começar com:

```text
merge aprovado em main
      ↓
deploy controlado
```

e não publicação irrestrita de qualquer mudança.

Deploy totalmente automático poderá ser habilitado após CI/CD possuir gates suficientes.

---

## 23. Deploy manual controlado inicial

Na primeira fase:

```text
main aprovada
   ↓
verificar checks
   ↓
iniciar redeploy pela Hostinger
   ↓
acompanhar build
   ↓
acompanhar runtime
```

Isso reduz risco enquanto o pipeline amadurece.

---

## 24. Identidade do deploy

Cada deploy deverá ser correlacionável com:

```text
commit SHA
timestamp
environment
resultado
```

Exemplo:

```text
APP_VERSION=d523567...
```

---

## 25. Build logs

Falhas de deploy deverão ser investigadas nos logs de build.

Os logs deverão permitir identificar:

```text
dependency failure
build failure
environment variable missing
Node version mismatch
type error
framework error
```

---

## 26. Runtime logs

Depois do deploy deverão ser verificados:

```text
startup errors
database errors
missing environment variables
API failures
unexpected exceptions
```

Runtime logs complementam a observabilidade da aplicação.

---

## 27. Variáveis de ambiente

Configuração específica do ambiente será fornecida externamente.

Exemplos:

```text
NODE_ENV
APP_URL
DATABASE_URL
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
PRIVATE_FILE_STORAGE_*
META_PIXEL_ID
META_CAPI_ACCESS_TOKEN
```

---

## 28. Segredos

Segredos de produção não serão:

```text
commitados
armazenados em AGENTS.md
armazenados em MEMORY.md
armazenados em documentação
copiados para issues
copiados para logs
```

---

## 29. `.env.example`

O repositório poderá manter:

```text
.env.example
```

com:

```text
nomes de variáveis
valores fictícios
comentários seguros
```

Nunca valores reais.

---

## 30. `.env`

`.env` local permanecerá ignorado pelo Git.

Em produção, valores serão configurados através do mecanismo de environment variables da infraestrutura.

---

## 31. Config validation

Na inicialização, a aplicação deverá validar configuração obrigatória.

Exemplo:

```text
DATABASE_URL ausente
→ startup falha
```

em vez de permitir erro silencioso posterior.

---

## 32. Variáveis públicas

Variáveis expostas ao frontend deverão possuir classificação explícita.

Segredos nunca deverão utilizar prefixo ou mecanismo que faça bundling client-side.

---

## 33. Banco de produção

Para a primeira infraestrutura gerenciada, o alvo inicial será:

```text
MySQL
```

hospedado de forma compatível com a aplicação.

Essa decisão aproveita o ambiente inicial sem tornar regras de domínio dependentes de MySQL.

---

## 34. Abstração do banco

Código de domínio não deverá depender de:

```text
host específico
nome físico da database
painel da Hostinger
```

A conexão ocorrerá via configuração.

---

## 35. Banco TEST

Banco de TEST será fisicamente ou logicamente separado do banco de PRODUCTION.

Nunca:

```text
teste automatizado
→ database de produção
```

---

## 36. Credencial de banco

A aplicação utilizará usuário próprio de banco.

Privilégios deverão ser os mínimos necessários.

Credenciais administrativas não deverão ser usadas como credenciais regulares da aplicação.

---

## 37. Migrations

Mudanças de schema serão realizadas somente por migrations versionadas.

Nunca utilizar como procedimento normal:

```text
abrir phpMyAdmin
→ alterar tabela manualmente
```

---

## 38. Migration files

Migrations fazem parte do código.

Fluxo:

```text
schema alterado
→ migration gerada
→ revisada
→ testada localmente
→ testada em TEST
→ commitada
→ aplicada em produção
```

---

## 39. Migration de produção

A migration de produção deverá usar mecanismo não-interativo apropriado ao ORM selecionado.

Caso Prisma seja adotado, o padrão esperado será equivalente a:

```text
prisma migrate deploy
```

e não comandos de desenvolvimento.

---

## 40. Migration gate

Uma migration só poderá chegar a produção após:

```text
review
test em banco não produtivo
backup quando necessário
plano de rollback/recovery
compatibilidade com aplicação
```

---

## 41. Migrations destrutivas

Exemplos de alto risco:

```text
DROP TABLE
DROP COLUMN
tipo incompatível
rename destrutivo
NOT NULL sobre dados existentes
alteração massiva
```

exigem revisão específica.

---

## 42. Expand and contract

Mudanças complexas deverão preferir padrão:

```text
EXPAND
→ adicionar estrutura compatível

MIGRATE
→ mover/adaptar dados

CONTRACT
→ remover estrutura antiga depois
```

Isso facilita rollback de aplicação.

---

## 43. Compatibilidade

Nova versão deverá evitar depender imediatamente de uma migration irreversível quando houver alternativa segura.

---

## 44. Rollback da aplicação

Se novo deploy falhar:

```text
detectar problema
     ↓
interromper rollout
     ↓
retornar à versão anterior
     ↓
health check
     ↓
investigar
```

---

## 45. Rollback ≠ rollback de banco

Voltar o código não implica automaticamente desfazer a migration.

Por isso migrations deverão preferir compatibilidade backward/forward durante janelas de rollout.

---

## 46. Rollback de banco

Rollback de dados poderá exigir:

```text
migration corretiva
restore
script controlado
```

e deverá ser tratado como operação de risco.

---

## 47. Backup antes de mudança crítica

Antes de migrations de alto risco:

```text
confirmar backup recente
```

e, quando apropriado:

```text
criar backup adicional
```

---

## 48. Estratégia de backup

Backups deverão cobrir pelo menos:

```text
banco de dados
assets digitais críticos
configurações operacionais necessárias
```

Código já permanece versionado no Git.

---

## 49. Backups do provedor

Backups gerenciados da hospedagem serão uma camada de proteção.

Eles não substituem completamente:

```text
estratégia de recuperação
teste de restore
backup lógico crítico
```

---

## 50. Backup lógico

Antes de operações sensíveis poderá ser criado dump do banco.

O dump deverá ser:

```text
protegido
acessível somente a pessoas autorizadas
retido pelo tempo necessário
```

---

## 51. Teste de restore

Periodicamente deverá existir teste de restauração.

Backup sem restore validado não será considerado garantia suficiente.

---

## 52. RPO

RPO representa a quantidade máxima aceitável de dados perdidos.

Meta formal será definida após conhecermos:

```text
volume de vendas
frequência de backup real
capacidades do provedor
criticidade operacional
```

---

## 53. RTO

RTO representa o tempo desejado para recuperação.

Será formalizado após o primeiro baseline operacional.

---

## 54. Digital assets

Ebooks e outros ativos comerciais permanecerão em storage privado.

O storage não poderá depender apenas de diretório público da aplicação.

---

## 55. Storage abstraction

A aplicação utilizará abstração equivalente a:

```text
DigitalAssetStorage
```

com operações como:

```text
put
get
issueTemporaryAccess
delete/archive
```

permitindo substituição de provedor.

---

## 56. Storage provider

O provedor físico definitivo de storage privado poderá ser escolhido separadamente.

Critérios:

```text
privacidade
URLs temporárias
controle de acesso
durabilidade
backup
custo
API estável
portabilidade
```

---

## 57. Filesystem local

Filesystem local da aplicação não deverá ser assumido como storage permanente confiável para produtos digitais.

Aplicação deve ser capaz de ser redeployada sem perder ativos comerciais.

---

## 58. Domínio

Produção utilizará domínio oficial da L'Essenc.

O domínio exato permanecerá configuração operacional até sua confirmação.

---

## 59. DNS

DNS deverá apontar somente após:

```text
produção validada
SSL disponível
health check funcional
configuração revisada
```

---

## 60. Mudança de DNS

Mudanças deverão ser planejadas considerando TTL.

Antes de migração importante poderá ser útil reduzir TTL com antecedência.

---

## 61. HTTPS

Produção funcionará exclusivamente sobre:

```text
https://
```

Certificado deverá ser válido.

---

## 62. HTTP

Tráfego HTTP deverá ser redirecionado para HTTPS quando suportado.

Nenhum login, checkout ou conteúdo sensível deverá operar por HTTP.

---

## 63. SSL gerenciado

A infraestrutura inicial poderá utilizar certificado SSL gerenciado pela Hostinger.

A renovação deverá continuar sendo monitorável mesmo quando automática.

---

## 64. CDN

CDN poderá ser utilizada para:

```text
assets públicos
imagens
CSS
JavaScript
conteúdo cacheável
```

---

## 65. Conteúdo privado e CDN

Ebooks e assets privados não deverão tornar-se públicos apenas por passarem por CDN.

Cache privado deverá ser configurado de forma compatível com autorização.

---

## 66. Cache

Rotas como:

```text
/admin
/api/payments
/api/delivery
/api/auth
```

não deverão utilizar cache público inadequado.

---

## 67. Health check

Produção deverá possuir endpoint mínimo:

```text
GET /api/health
```

---

## 68. Health pós-deploy

Após cada deploy verificar:

```text
processo iniciado
health = OK
database acessível
páginas principais carregam
APIs críticas respondem
```

---

## 69. Smoke tests

Smoke tests mínimos:

```text
GET /
GET sales page
abrir checkout
GET /api/health
login admin
carregar dashboard
```

Sem criar transações reais desnecessariamente.

---

## 70. Smoke financeiro

Em ambiente TEST deverá validar:

```text
criar Order
criar Payment de teste
receber webhook
aprovar Payment
gerar Entitlement
gerar Delivery
```

---

## 71. Go-live financeiro

Antes de habilitar pagamento real:

```text
Mercado Pago produção configurado
Webhook produção configurado
assinatura validada
idempotência validada
reconciliação validada
entitlement validado
delivery validada
```

---

## 72. Webhook URL

URL de produção será semelhante conceitualmente a:

```text
https://dominio/api/webhooks/mercadopago
```

A URL definitiva dependerá do domínio oficial.

---

## 73. APP_URL

`APP_URL` será específica por ambiente.

Exemplo:

```text
LOCAL
http://localhost:3000

TEST
https://test...

PRODUCTION
https://dominio-oficial...
```

---

## 74. Ordem de configuração inicial

Antes do primeiro deploy produtivo:

```text
1. criar aplicação
2. conectar GitHub
3. selecionar Node
4. definir build/start
5. criar banco
6. configurar environment variables
7. executar migrations
8. deploy
9. health check
10. conectar domínio
11. validar HTTPS
12. configurar Mercado Pago
13. validar webhook
```

---

## 75. Start command

O `package.json` deverá possuir script de produção válido.

Conceitualmente:

```text
pnpm start
```

---

## 76. Porta

A aplicação deverá respeitar requisitos do runtime da Hostinger.

Nenhuma porta pública arbitrária deverá ser hardcoded no domínio.

---

## 77. Runtime stateless

A aplicação deverá ser tratada preferencialmente como stateless.

Sessão, pagamentos e direitos não poderão depender de memória de um único processo.

---

## 78. Restart

Reiniciar aplicação não poderá causar perda de:

```text
Order
Payment
Entitlement
Delivery persistida
sessão persistente quando aplicável
```

---

## 79. Jobs

Jobs essenciais não deverão depender de um processo local não confiável sem mecanismo de recuperação.

Exemplos:

```text
reconciliation
expiration
cleanup
```

---

## 80. Jobs e idempotência

Jobs deverão ser idempotentes sempre que possível.

Execução duplicada não poderá produzir efeitos financeiros duplicados.

---

## 81. Scheduled jobs

Se a infraestrutura gerenciada não suportar adequadamente determinado job futuro, poderá ser utilizado serviço externo ou evolução de infraestrutura.

Isso não deverá alterar regras de domínio.

---

## 82. Deploy e jobs

Deploy não deverá interromper permanentemente processamento pendente.

Jobs deverão recuperar trabalho após reinício quando necessário.

---

## 83. Monitoramento pós-deploy

Após cada deploy observar:

```text
5xx
runtime errors
database errors
latência
payment failures
webhook failures
delivery failures
```

---

## 84. Janela de observação

Mudanças críticas deverão permanecer sob observação operacional após publicação.

Não considerar deploy bem sucedido apenas porque o build terminou.

---

## 85. Kill switch

Produção deverá permitir desabilitar rapidamente funcionalidades críticas quando possível.

Exemplos:

```text
CHECKOUT_ENABLED=false
DELIVERY_ENABLED=false
```

Uso real dependerá da implementação.

---

## 86. Feature flags

Feature flags operacionais críticas serão configuradas server-side.

Nunca constituirão autorização de segurança.

---

## 87. Incidente de deploy

Se um deploy causar incidente:

```text
detectar
→ conter
→ rollback quando seguro
→ confirmar recuperação
→ preservar evidências
→ investigar
```

---

## 88. Deploy failed

Se o build falhar:

```text
nova versão não entra em produção
```

A versão anterior deverá permanecer operacional quando a plataforma permitir.

---

## 89. Migration failed

Se migration falhar:

```text
interromper deploy
não improvisar alteração manual
avaliar estado do banco
executar plano de recuperação
```

---

## 90. Secret rotation

Após rotação de segredo:

```text
atualizar environment variable
→ aplicar/reiniciar quando necessário
→ validar integração
→ revogar segredo antigo
```

---

## 91. Mercado Pago secret rotation

Rotação de:

```text
Access Token
Webhook Secret
```

deverá possuir procedimento próprio e teste após alteração.

---

## 92. Database credential rotation

Nova credencial deverá ser validada antes da revogação definitiva da anterior quando o procedimento permitir.

---

## 93. Disaster recovery

Cenários considerados:

```text
deploy quebrado
database corrompido
credencial comprometida
Hostinger indisponível
asset perdido
domínio/DNS comprometido
Mercado Pago indisponível
```

---

## 94. Falha da Hostinger

Aplicação deverá possuir documentação suficiente para ser reconstruída em outro provedor usando:

```text
Git
environment variables
database backup
asset backup
documentação
```

---

## 95. Vendor exit

A existência de uma estratégia de saída faz parte da arquitetura.

L'Essenc não deverá depender da Hostinger para possuir:

```text
código
dados
assets
configuração conceitual
```

---

## 96. Banco exportável

Deverá ser possível gerar exportação lógica do banco.

Isso será requisito para:

```text
backup
migração
disaster recovery
vendor exit
```

---

## 97. Assets exportáveis

Ativos digitais deverão permanecer recuperáveis independentemente da aplicação.

---

## 98. Logs de deploy

Registrar:

```text
commit
ambiente
horário
resultado
operador ou sistema
```

---

## 99. Auditoria de produção

Ações de alta criticidade na infraestrutura deverão ser minimizadas e registradas operacionalmente.

---

## 100. Acesso à Hostinger

Conta e acessos administrativos da Hostinger deverão utilizar:

```text
MFA
credenciais individuais
menor privilégio
```

quando suportado.

---

## 101. Acesso ao GitHub

GitHub também deverá possuir MFA e princípio de menor privilégio.

Produção não deverá depender de token pessoal excessivamente privilegiado quando existir alternativa apropriada.

---

## 102. Deploy permission

Poucas identidades deverão possuir capacidade de publicar em produção.

---

## 103. Checklist pré-deploy

Antes de deploy produtivo:

```text
branch correta
commit correto
working tree esperado
CI/checks aprovados
build aprovado
migration revisada
backup confirmado quando necessário
environment variables revisadas
rollback conhecido
```

---

## 104. Checklist pós-deploy

Depois:

```text
deploy concluído
health OK
home OK
checkout OK
admin OK
database OK
logs sem erro crítico
webhook operacional
observabilidade normal
```

---

## 105. Checklist de go-live

Antes do primeiro tráfego real:

```text
domínio oficial
DNS correto
SSL válido
produção isolada
database backup ativo
restore compreendido
Mercado Pago produção
webhook validado
storage privado
MFA admin
rate limiting crítico
logs seguros
alertas críticos
terms/privacy aplicáveis
smoke tests
security review
```

---

## 106. Primeiro lançamento

O lançamento deverá poder ser interrompido rapidamente.

Não iniciar grande volume de tráfego pago antes de validar:

```text
checkout real
aprovação
webhook
entitlement
delivery
analytics
reembolso operacional
```

---

## 107. Ramp-up

Tráfego poderá crescer progressivamente:

```text
teste interno
↓
transações reais controladas
↓
baixo volume
↓
monitoramento
↓
escala
```

---

## 108. Capacidade

A infraestrutura inicial deverá ser monitorada antes de qualquer upgrade.

Escala deverá ser baseada em:

```text
CPU
memória
latência
erro
volume
conversão
```

e não apenas expectativa.

---

## 109. Escalabilidade

Se a demanda ultrapassar a capacidade do Cloud Startup:

```text
scale up
ou
migração de infraestrutura
```

deverá ser possível sem alterar regras centrais de negócio.

---

## 110. Definition of Done de deploy

Uma funcionalidade que exige infraestrutura não estará concluída apenas quando funciona localmente.

Deverá existir:

```text
configuração por ambiente
procedimento de deploy
observabilidade
segurança
rollback/recovery
```

quando aplicável.

---

## 111. Pendências operacionais pré-go-live

Ainda precisarão ser confirmados:

```text
domínio oficial
provedor físico de storage privado
credenciais de produção Mercado Pago
política comercial de reembolso/suporte
configuração final de banco
política definitiva de backup/retenção
```

Essas pendências não impedem o início da implementação.

---

## 112. Critérios de aceite

O `LES-DEPLOY-DIG-R01` estará apto para aprovação quando:

- infraestrutura inicial estiver definida;
- ambientes LOCAL, TEST e PRODUCTION estiverem definidos;
- produção estiver vinculada somente a código aprovado;
- build reproduzível estiver previsto;
- secrets permanecerem fora do Git;
- variáveis de ambiente estiverem separadas;
- banco de produção estiver isolado;
- migrations forem versionadas;
- migrations destrutivas possuírem controle;
- rollback de aplicação estiver previsto;
- rollback de aplicação estiver separado de rollback de banco;
- backups fizerem parte do deploy seguro;
- restore estiver previsto;
- storage privado estiver desacoplado;
- domínio, DNS e HTTPS estiverem cobertos;
- health checks e smoke tests estiverem definidos;
- go-live financeiro possuir checklist;
- observabilidade pós-deploy estiver prevista;
- disaster recovery estiver considerado;
- vendor exit estiver previsto;
- rollout inicial puder ocorrer gradualmente.

---

## 113. Decisão central de deploy

A primeira produção da L'Essenc Digital utilizará:

```text
GitHub
   ↓
main aprovada
   ↓
Hostinger Cloud Startup
   ↓
Node.js / Next.js
   ↓
Banco MySQL
   ↓
Mercado Pago
   ↓
Storage privado
```

A Hostinger será infraestrutura, não parte do domínio da aplicação.

O princípio será:

```text
código versionado
+
configuração externa
+
migrations versionadas
+
dados recuperáveis
+
assets recuperáveis
+
deploy reproduzível
+
rollback
+
backup
+
observabilidade
```

permitindo que a plataforma seja operada com segurança e migrada futuramente sem reconstrução do negócio.
