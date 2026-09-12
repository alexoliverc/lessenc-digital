# LES-SEC-DIG-R01 — Arquitetura de Segurança da L'Essenc Digital

**STATUS: HISTORICAL / SUPERSEDED.** Preservado para o histórico do projeto; consulte [docs/README.md](../README.md) e a [segurança canônica](../security/README.md). Controles antigos só valem quando compatíveis com a baseline atual.

> **Baseline histórica MVP-ARCH-01:** a arquitetura extensa permanece como referência de controles não conflitantes. A fonte atual de invariantes P00–P04 é o [índice de segurança](../security/README.md); nenhuma implementação é inferida de um requisito documentado.

**Projeto:** L'Essenc Digital
**Documento:** LES-SEC-DIG-R01
**Revisão:** R01
**Status:** Aprovado
**Data:** 11/09/2026
**Fase:** MVP-ARCH-01 — Arquitetura técnica do MVP

---

## 1. Objetivo

Este documento estabelece a arquitetura geral de segurança da L'Essenc Digital.

A segurança será tratada como requisito transversal da plataforma e deverá proteger:

- receita;
- pagamentos;
- produtos digitais;
- dados pessoais;
- contas administrativas;
- credenciais;
- infraestrutura;
- integrações externas;
- logs e auditoria;
- cadeia de desenvolvimento e implantação.

A segurança não será adicionada apenas ao final da implementação.

---

## 2. Baseline de segurança

A arquitetura utilizará como referências principais:

- OWASP ASVS 5.0.0;
- OWASP Top 10:2025;
- OWASP API Security Top 10:2023;
- OWASP Cheat Sheet Series;
- boas práticas específicas dos frameworks e provedores utilizados.

O alvo inicial de verificação será:

```text
OWASP ASVS Level 2
```

Controles adicionais poderão ser aplicados em áreas de maior criticidade, como:

- autenticação administrativa;
- pagamentos;
- segredos;
- autorização;
- entrega digital;
- auditoria.

Esta definição representa um objetivo de engenharia e verificação, não uma declaração antecipada de conformidade.

---

## 3. Princípios fundamentais

A arquitetura seguirá:

```text
deny by default
least privilege
defense in depth
secure by default
fail securely
server-side authority
minimização de dados
separação de ambientes
segregação de responsabilidades
auditabilidade
reversibilidade
```

Nenhuma decisão crítica deverá depender apenas de controles implementados no navegador.

---

## 4. Modelo de confiança

A aplicação deverá considerar como não confiáveis:

```text
browser
cliente
query parameters
headers fornecidos pelo usuário
cookies não validados
uploads
webhooks antes de autenticação
callbacks externos
URLs externas
dados de analytics
dados de terceiros
```

Todos deverão passar por validação apropriada antes de produzir efeitos.

---

## 5. Limites de confiança

A arquitetura deverá reconhecer pelo menos:

```text
Internet
   │
   ▼
Frontend público
   │
   ▼
Backend
   │
   ├── Banco
   ├── Storage privado
   ├── Mercado Pago
   └── Serviços externos
```

Além de:

```text
Internet
   │
   ▼
Painel administrativo
   │
   ▼
Backend privilegiado
```

Cada transição entre zonas representa uma fronteira de confiança.

---

## 6. Superfícies críticas

As áreas com maior criticidade são:

```text
/admin
/api/auth/*
/api/payments/*
/api/webhooks/*
/api/delivery/*
storage privado
banco de dados
segredos
pipeline de deploy
GitHub
Hostinger
Mercado Pago
```

Essas superfícies exigirão controles adicionais e testes específicos.

---

## 7. Autenticação administrativa

O painel administrativo deverá exigir autenticação forte.

Nenhuma área administrativa ficará acessível apenas por conhecer uma URL.

A autenticação deverá suportar:

```text
identidade individual
+
credencial forte
+
MFA
```

Contas compartilhadas deverão ser evitadas.

---

## 8. MFA administrativo

MFA será obrigatório para contas com acesso ao painel administrativo de produção.

Métodos deverão priorizar mecanismos resistentes a comprometimento quando a infraestrutura adotada permitir.

A política definitiva será escolhida durante implementação.

---

## 9. Senhas

Caso autenticação local por senha seja adotada, senhas:

```text
não serão criptografadas reversivelmente
não serão armazenadas em texto puro
não serão registradas em logs
```

Serão protegidas com algoritmo moderno de password hashing.

Preferência:

```text
Argon2id
```

Parâmetros deverão ser definidos e testados conforme capacidade real da infraestrutura na época da implementação.

---

## 10. Recuperação de conta

Fluxos de recuperação deverão ser tratados como autenticação de alto risco.

Tokens de recuperação deverão ser:

```text
aleatórios
temporários
uso único
revogáveis
armazenados de forma protegida
```

Nunca informar de forma insegura se determinado endereço possui conta privilegiada quando isso criar risco desnecessário.

---

## 11. Sessões administrativas

Sessões autenticadas deverão utilizar mecanismos seguros.

Preferência para aplicação web:

```text
cookies HttpOnly
Secure em produção
SameSite apropriado
Path restritivo quando aplicável
```

Tokens de sessão não deverão ser armazenados em:

```text
localStorage
sessionStorage
URL
query string
```

---

## 12. Fixação e renovação de sessão

A sessão deverá ser renovada após:

```text
login
elevação de privilégio
alteração de credencial
eventos de segurança relevantes
```

Sessões antigas deverão ser invalidadas quando necessário.

---

## 13. Expiração de sessão

O painel administrativo deverá possuir:

```text
idle timeout
+
absolute timeout
```

Valores serão definidos durante implementação conforme risco e experiência operacional.

Operações extremamente sensíveis poderão exigir reautenticação.

---

## 14. Logout

Logout deverá invalidar a sessão no servidor quando o mecanismo adotado possuir estado server-side.

Não será suficiente apenas apagar uma informação visual no navegador.

---

## 15. Autorização

Autenticação e autorização serão tratadas separadamente.

Exemplo:

```text
usuário autenticado
≠
usuário autorizado
```

Cada operação administrativa deverá verificar permissão no servidor.

---

## 16. RBAC inicial

Papéis previstos:

```text
OWNER
ADMIN
SUPPORT
```

Permissões serão concedidas pelo menor privilégio necessário.

Exemplo:

```text
SUPPORT
→ visualizar pedido
→ verificar acesso
→ reemitir entrega autorizada

SUPPORT
≠
alterar configuração financeira
≠
gerenciar segredos
```

---

## 17. Proteção contra IDOR/BOLA

Toda rota que opere sobre IDs deverá verificar propriedade ou privilégio.

Nunca:

```text
GET /api/order/123
→ retorna porque ID existe
```

Correto:

```text
request
→ autenticação
→ autorização
→ validação do recurso
→ resposta
```

IDs difíceis de adivinhar não substituem autorização.

---

## 18. Validação de entrada

Entradas deverão possuir:

```text
schema explícito
tipo
limites de tamanho
formato
valores permitidos
```

A validação principal ocorrerá server-side.

Validação client-side terá função de UX.

---

## 19. Mass assignment

Objetos vindos do cliente não deverão ser persistidos diretamente.

Nunca:

```text
database.update(request.body)
```

Preferir:

```text
schema validado
→ campos explicitamente permitidos
→ comando de domínio
```

---

## 20. Injection

A aplicação deverá prevenir:

```text
SQL Injection
OS Command Injection
NoSQL Injection
template injection
header injection
log injection
```

Queries deverão utilizar abstrações parametrizadas.

Entrada do usuário nunca deverá compor comandos de sistema diretamente.

---

## 21. XSS

Conteúdo controlado por usuários ou administração deverá possuir tratamento apropriado ao contexto.

HTML arbitrário será evitado sempre que possível.

Quando conteúdo rico for necessário:

```text
allowlist
+
sanitização confiável
+
encoding de saída
```

---

## 22. Content Security Policy

Produção deverá adotar `Content-Security-Policy`.

Objetivos:

```text
reduzir XSS
limitar scripts
limitar frames
limitar conexões
limitar recursos externos
```

A política será criada conforme os domínios realmente necessários.

Evitar política permissiva como solução permanente.

---

## 23. Headers de segurança

A aplicação deverá avaliar e configurar:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
frame-ancestors via CSP
```

Configurações incompatíveis com funcionalidade real deverão ser testadas antes da produção.

---

## 24. HTTPS

Ambiente de produção deverá operar exclusivamente sobre HTTPS.

HTTP deverá redirecionar de forma segura para HTTPS quando aplicável.

Nenhuma credencial ou sessão poderá trafegar por conexão não criptografada.

---

## 25. CSRF

Operações autenticadas por cookie deverão possuir proteção contra CSRF.

`SameSite` será considerado defesa adicional, não substituição automática de proteção apropriada.

Operações de mudança de estado não deverão utilizar `GET`.

---

## 26. CORS

CORS será configurado pelo princípio:

```text
somente origens necessárias
```

Evitar:

```text
Access-Control-Allow-Origin: *
```

em APIs autenticadas ou privilegiadas.

CORS não substitui autorização.

---

## 27. Rate limiting

Rate limiting será aplicado proporcionalmente ao risco.

Prioridades:

```text
login
recuperação de conta
checkout
criação de pagamentos
webhooks abusivos
entrega digital
endpoints administrativos
```

Limites deverão considerar IP, identidade e recurso conforme aplicável.

---

## 28. Anti-automação

Fluxos sujeitos a abuso deverão possuir mecanismos progressivos.

Exemplos:

```text
rate limit
backoff
lock temporário
monitoramento
challenge adicional quando necessário
```

Não implementar CAPTCHA indiscriminadamente sem necessidade.

---

## 29. Segurança do webhook

Os requisitos de `LES-INT-MP-R01` permanecem obrigatórios.

Webhook deverá passar por:

```text
validação da assinatura
→ validação estrutural
→ idempotência
→ resolução do recurso
→ consulta server-side
→ máquina de estados
```

Nunca conceder acesso apenas com payload recebido.

---

## 30. Entrega digital

Ativos digitais permanecerão fora de diretório público.

Acesso deverá depender de:

```text
Entitlement.ACTIVE
+
DigitalAsset.ACTIVE
+
autorização server-side
```

O nome ou caminho do arquivo não poderá constituir mecanismo de segurança.

---

## 31. Tokens de entrega

Quando utilizados, tokens deverão ser:

```text
imprevisíveis
temporários
limitados ao recurso
revogáveis quando aplicável
```

Quando possível, somente versão derivada/hash deverá permanecer persistida.

---

## 32. Upload administrativo

Uploads de ebooks e materiais deverão ser tratados como entrada não confiável.

O sistema deverá validar:

```text
extensão permitida
MIME esperado
assinatura do arquivo quando aplicável
tamanho máximo
nome seguro
destino privado
permissões
```

Arquivos executáveis não deverão ser aceitos em funcionalidades destinadas a documentos.

---

## 33. Nomes de arquivos

Nomes fornecidos pelo upload não deverão ser utilizados diretamente como caminho físico.

O storage deverá utilizar identificadores internos seguros.

Prevenir:

```text
path traversal
../
colisão
overwrite indevido
```

---

## 34. SSRF

Funcionalidades que façam requisições server-side a URLs deverão ser restritas.

Quando destinos forem conhecidos:

```text
allowlist
```

deverá ser preferida.

A aplicação não deverá permitir livre acesso a:

```text
localhost
rede interna
metadata endpoints
file://
protocolos inesperados
```

através de parâmetros fornecidos pelo usuário.

---

## 35. Segredos

São considerados segredos:

```text
Mercado Pago Access Token
Webhook Secret
DATABASE_URL
session secrets
chaves criptográficas
tokens de deploy
credenciais de storage
GitHub tokens
```

Segredos não deverão ser versionados.

---

## 36. Gestão de segredos

Segredos deverão possuir ciclo de vida:

```text
criação
provisionamento
uso
rotação
revogação
expiração
```

Acesso deverá seguir menor privilégio.

Produção deverá utilizar solução apropriada de configuração/segredos da infraestrutura adotada.

---

## 37. `.env`

`.env` será apenas mecanismo local.

Regras:

```text
.env → nunca Git
.env.example → somente nomes/exemplos fictícios
produção → configuração externa segura
```

Segredos reais não deverão aparecer em documentação.

---

## 38. Exposição acidental de segredo

Se um segredo real for versionado:

```text
remover do código
+
revogar imediatamente
+
emitir novo segredo
+
investigar uso
+
avaliar limpeza do histórico
```

Apagar apenas a linha de um commit posterior não será considerado resposta suficiente.

---

## 39. Banco de dados

A aplicação utilizará credencial própria de banco com privilégios mínimos.

A conta da aplicação não deverá possuir privilégios administrativos desnecessários.

Ambientes terão credenciais separadas.

---

## 40. Acesso direto ao banco

Acesso manual ao banco de produção deverá ser excepcional e restrito.

Operações normais deverão ocorrer através de:

```text
aplicação
migrations
procedimentos operacionais aprovados
```

---

## 41. Proteção de dados

Dados pessoais serão minimizados.

Evitar armazenamento quando não houver finalidade documentada.

Dados sensíveis não deverão ser replicados em:

```text
logs
analytics
metadata
query strings
URLs
mensagens de erro
```

---

## 42. Logs

Logs de segurança deverão registrar eventos úteis sem registrar segredos.

Exemplos de eventos relevantes:

```text
login success/failure
MFA failure
authorization failure
webhook invalid
payment transition
entitlement revoke
admin operation
security configuration change
rate limit
unexpected error
```

---

## 43. Dados proibidos em logs

Nunca registrar em texto puro:

```text
senhas
Access Tokens
Webhook Secrets
session IDs
tokens de recuperação
CVV
PAN completo
connection strings
chaves privadas
```

PII deverá ser mascarada ou omitida quando não necessária.

---

## 44. Correlation ID

Fluxos críticos deverão possuir identificador de correlação.

Isso permitirá:

```text
request
→ order
→ payment
→ webhook
→ entitlement
→ delivery
```

sem necessidade de registrar conteúdo sensível.

---

## 45. Tratamento de erros

Usuários externos deverão receber mensagens seguras.

Nunca expor:

```text
stack trace
SQL
paths internos
credenciais
variáveis de ambiente
detalhes de infraestrutura
```

Erros detalhados poderão ser registrados internamente de forma segura.

---

## 46. Exceptional conditions

A arquitetura deverá assumir que:

```text
dependências falham
rede falha
banco falha
storage falha
payloads são inesperados
estados externos mudam
```

Condições excepcionais deverão falhar de forma segura e observável.

---

## 47. Supply chain

Dependências representam superfície de ataque.

A política incluirá:

```text
lockfile versionado
versões controladas
dependências mínimas
revisão antes de adicionar pacote
monitoramento de vulnerabilidades
atualizações controladas
```

Dependência sem finalidade clara não deverá ser adicionada.

---

## 48. Dependências críticas

Bibliotecas relacionadas a:

```text
autenticação
criptografia
pagamento
sessão
ORM
upload
```

deverão receber revisão adicional.

Evitar implementações criptográficas próprias quando biblioteca madura e apropriada existir.

---

## 49. Scripts de dependências

Pacotes capazes de executar scripts de instalação deverão ser tratados como código potencialmente privilegiado.

Mudanças relevantes de dependência deverão ser revisadas através do lockfile.

---

## 50. GitHub

O repositório deverá permanecer privado durante desenvolvimento enquanto essa for a política vigente.

Controles esperados:

```text
MFA da conta
permissões mínimas
branch protection futura
secret scanning quando disponível
revisão por PR
tokens com escopo mínimo
```

---

## 51. Branch principal

`main` deverá representar estado aprovado.

Mudanças deverão seguir:

```text
branch
→ validação
→ commit
→ push
→ Pull Request
→ checks
→ merge
```

Push direto para `main` deverá ser evitado após estabelecimento completo do fluxo remoto.

---

## 52. CI/CD

Antes de deploy, o pipeline deverá evoluir para executar:

```text
lint
typecheck
tests
build
dependency/security checks
secret scanning
```

Falha em gate crítico deverá impedir promoção.

---

## 53. Ambientes

Manter separação entre:

```text
Local
Test
Production
```

Cada ambiente deverá possuir:

```text
banco separado
segredos separados
configurações separadas
storage separado quando necessário
credenciais Mercado Pago separadas
```

---

## 54. Produção

Ambiente de produção deverá restringir:

```text
debug
stack traces públicos
hot reload
ferramentas de desenvolvimento
endpoints experimentais
credenciais de teste
```

Configuração deverá ser explicitamente preparada para produção.

---

## 55. Painel administrativo

Painel terá controles superiores aos da área pública.

Esperado:

```text
MFA
sessão curta
RBAC
rate limiting
auditoria
reauth para ações críticas
proteção contra CSRF
sem indexação pública
```

Ocultar o caminho `/admin` não será considerado controle de segurança.

---

## 56. Operações administrativas críticas

Ações como:

```text
reembolso
revogação de entitlement
alteração de privilégio
alteração de produto ativo
mudança de preço
reemitir entrega
alterar configuração financeira
```

deverão possuir autorização explícita e auditoria.

Algumas poderão exigir reautenticação.

---

## 57. Auditoria

`AuditEvent` deverá preservar:

```text
ator
ação
alvo
timestamp
correlationId
resultado
contexto mínimo seguro
```

Eventos deverão ser resistentes a alteração casual pela própria aplicação.

---

## 58. Backup

Dados críticos deverão possuir estratégia de backup.

Backup deverá considerar:

```text
banco
configuração crítica
metadados de ativos
documentação operacional necessária
```

Segredos não deverão ser copiados de forma insegura junto com backup comum.

---

## 59. Restore

Backup não será considerado confiável sem teste de restauração.

Procedimentos de restore deverão ser testados periodicamente.

RTO e RPO serão definidos no documento de deploy/operação.

---

## 60. Segurança do storage

Storage privado deverá possuir:

```text
acesso não público
credenciais mínimas
segregação de ambiente
controle de leitura/escrita
logs quando disponíveis
```

Aplicação deverá ser a autoridade para liberar conteúdo.

---

## 61. Threat modeling

Antes da implementação de cada superfície crítica deverá ser realizada análise de ameaça proporcional ao risco.

Prioridades:

```text
checkout
webhooks
admin
delivery
auth
uploads
storage
```

Pergunta principal:

> o que um atacante ganharia se controlasse esta entrada?

---

## 62. Testes de segurança

Antes de produção, deverão existir testes cobrindo pelo menos:

```text
authorization bypass
IDOR/BOLA
authentication
session handling
CSRF
XSS
injection
webhook forgery
idempotency
rate limiting
delivery bypass
file access
secret exposure
error leakage
```

---

## 63. Testes automatizados

Controles críticos deverão possuir testes automatizados quando praticável.

Exemplo:

```text
usuário SUPPORT
→ tenta alterar configuração financeira
→ 403
```

ou:

```text
entitlement REVOKED
→ tenta acessar asset
→ acesso negado
```

---

## 64. Pentest

Após a plataforma atingir maturidade funcional suficiente e antes do go-live significativo, deverá ser realizado teste de segurança dedicado.

Poderá incluir:

```text
DAST
manual testing
authorization testing
business logic testing
API testing
```

Não será tratado como substituto do desenvolvimento seguro.

---

## 65. Segurança contínua

Segurança não termina no lançamento.

A operação deverá incluir:

```text
monitoramento
atualização de dependências
revisão de alertas
rotação de segredos
revisão de acesso
testes periódicos
incidentes
```

---

## 66. Resposta a incidentes

Deverá existir procedimento mínimo para:

```text
detecção
contenção
erradicação
recuperação
análise
registro
```

Exemplos:

```text
token exposto
conta admin comprometida
webhook abusado
vazamento de PDF
banco exposto
dependência vulnerável
```

---

## 67. Kill switches

Onde viável, recursos críticos deverão permitir bloqueio rápido.

Exemplos:

```text
desativar checkout
desativar nova entrega
revogar sessão administrativa
rotacionar segredo
desativar integração específica
```

Isso reduz tempo de contenção.

---

## 68. Privacidade

Segurança e privacidade serão tratadas de forma complementar.

Princípios:

```text
coletar menos
reter apenas necessário
limitar acesso
proteger transmissão
proteger armazenamento
eliminar quando aplicável
```

Requisitos legais específicos serão tratados separadamente e não são presumidos como satisfeitos apenas por esta arquitetura.

---

## 69. Analytics

Scripts de analytics serão considerados terceiros executando no contexto da aplicação.

Deverão ser minimizados e avaliados.

Analytics não deverá receber:

```text
segredos
tokens
dados financeiros sensíveis
conteúdo administrativo
```

Rotas sensíveis poderão ter analytics completamente desativado.

---

## 70. Terceiros

Toda integração externa aumenta superfície de ataque.

Antes de adicionar serviço externo, avaliar:

```text
dados enviados
permissões
credenciais
necessidade
política de segurança
risco de indisponibilidade
risco de supply chain
```

---

## 71. Security gates por fase

Antes de implementar:

```text
ameaças identificadas
requisitos definidos
```

Antes do commit:

```text
diff revisado
sem segredos
testes aplicáveis
```

Antes do merge:

```text
checks aprovados
revisão
```

Antes do deploy:

```text
build aprovado
configuração revisada
segredos corretos
rollback conhecido
```

Antes do go-live:

```text
security review
testes críticos
backup/restore
monitoramento
incident response
```

---

## 72. Matriz inicial de prioridades

### P0 — obrigatório antes de produção

```text
HTTPS
segredos fora do Git
autorização server-side
MFA admin
sessões seguras
pagamento server-side
webhook autenticado
entitlement protegido
storage privado
input validation
SQL parametrizado
CSRF quando aplicável
rate limiting crítico
logs sem segredos
backup
```

### P1 — necessário para operação madura

```text
CSP endurecida
alertas
secret scanning
dependency scanning
branch protection
reconciliation monitoring
restore testing
security regression tests
```

### P2 — evolução

```text
automação avançada de rotação
WAF conforme necessidade
SIEM
SBOM automatizado
pentest recorrente
controles avançados de detecção
```

---

## 73. Critérios de aceite

O `LES-SEC-DIG-R01` estará apto para aprovação quando:

- existir baseline de segurança definido;
- backend for autoridade para controles críticos;
- autenticação administrativa exigir proteção forte;
- autorização server-side for obrigatória;
- sessões possuírem política segura;
- entradas forem validadas;
- proteção contra injection, XSS e CSRF estiver prevista;
- APIs forem protegidas contra IDOR/BOLA;
- storage digital permanecer privado;
- uploads forem tratados como não confiáveis;
- SSRF estiver considerado;
- segredos possuírem política de ciclo de vida;
- logs evitarem dados sensíveis;
- supply chain estiver dentro do modelo de ameaça;
- ambientes forem segregados;
- painel administrativo tiver controles reforçados;
- backup e restore fizerem parte da arquitetura;
- resposta a incidentes estiver prevista;
- testes de segurança fizerem parte do Definition of Done;
- o projeto possuir caminho para verificação ASVS Level 2.

---

## 74. Decisão central de segurança

A L'Essenc Digital adotará segurança por arquitetura, não apenas por correções posteriores.

O modelo será:

```text
entrada não confiável
        ↓
validação
        ↓
autenticação quando aplicável
        ↓
autorização
        ↓
regra de negócio
        ↓
efeito controlado
        ↓
auditoria
        ↓
observabilidade
```

Segurança não dependerá de:

```text
URL escondida
ID difícil de adivinhar
frontend
boa-fé do cliente
callback do navegador
ausência atual de ataques
```

A plataforma deverá assumir que controles serão testados por entradas maliciosas e deverá continuar segura quando componentes externos falharem.
