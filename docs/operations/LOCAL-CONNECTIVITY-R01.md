# LOCAL-CONNECTIVITY-R01 — Windows, VS Code, Codex e Git

**STATUS: HISTORICAL / SUPERSEDED.** Este guia registra o bootstrap inicial e não define a baseline operacional atual. Consulte [docs/README.md](../README.md), [AGENTS.md](../../AGENTS.md) e [operações atuais](README.md) antes de usar comandos históricos.

## Resultado esperado

O VS Code e o Codex devem abrir o mesmo diretório físico:

```text
C:\Projetos\lessenc-digital
```

O Git controla as versões desse diretório. O VS Code edita e executa o projeto. O Codex lê as regras do `AGENTS.md`, consulta a memória e altera somente o escopo autorizado.

## 1. Preparar o diretório

Abra o PowerShell na pasta onde este scaffold foi baixado e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\lessenc-digital\scripts\bootstrap-windows.ps1
```

Se a pasta já estiver no local correto, execute o script a partir dela:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\bootstrap-windows.ps1 -TargetRoot "C:\Projetos\lessenc-digital"
```

## 2. Abrir no VS Code

```powershell
Set-Location "C:\Projetos\lessenc-digital"
code .
```

Instale as extensões exibidas pelas recomendações do workspace. O arquivo `.vscode/settings.json` já padroniza final de linha, formatação e exclusões.

## 3. Abrir o Codex no mesmo diretório

Use o terminal integrado do VS Code ou um PowerShell separado, sempre dentro de:

```powershell
Set-Location "C:\Projetos\lessenc-digital"
```

Se o comando do Codex estiver instalado no computador, inicie-o nesse diretório. Se o Codex estiver sendo usado pela interface do ChatGPT, selecione este mesmo repositório/pasta como workspace do projeto.

O ponto de integração é o diretório compartilhado e o Git: não são duas cópias independentes do código.

## 4. Primeiro ciclo de Git

```powershell
Set-Location "C:\Projetos\lessenc-digital"
git status
git add .
git commit -m "chore: bootstrap lessenc digital"
```

Depois, crie um repositório privado vazio no GitHub e conecte-o:

```powershell
git remote add origin "https://github.com/SEU_USUARIO/lessenc-digital.git"
git push -u origin main
```

Substitua a URL pelo repositório real. Nunca coloque tokens na URL ou em arquivos versionados.

## 5. Rotina diária

```powershell
git pull --ff-only
git status
```

Antes de pedir uma alteração ao Codex, informe objetivo e escopo. Depois da alteração:

```powershell
git diff
git status
```

Só faça commit depois de testes e revisão do diff.

## 6. Variáveis locais

O arquivo `.env.example` documenta somente nomes de variáveis. Copie para `.env` no ambiente local e preencha apenas com credenciais de teste. O `.gitignore` impede o envio do `.env` ao Git.

Credenciais de produção devem entrar somente no ambiente de implantação ou no mecanismo de segredos escolhido para a operação.

## 7. Diagnóstico rápido

### VS Code abriu outra pasta

Verifique:

```powershell
Get-Location
git rev-parse --show-toplevel
```

O resultado deve apontar para `C:\Projetos\lessenc-digital`.

### O Codex não encontra as regras

Confirme que `AGENTS.md` está na raiz do mesmo diretório aberto pelo Codex e pelo VS Code.

### O Git mostra muitos arquivos inesperados

Execute `git status --short` e confira se são apenas arquivos do projeto. Não use comandos destrutivos para “limpar” sem identificar o alvo.
