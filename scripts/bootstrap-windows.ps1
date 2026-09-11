[CmdletBinding()]
param(
    [string]$TargetRoot = "C:\Projetos\lessenc-digital",
    [switch]$SkipCodeOpen
)

$ErrorActionPreference = "Stop"
$sourceRoot = Split-Path -Parent $PSScriptRoot

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando obrigatório não encontrado: $Name"
    }
}

Require-Command "git"
Require-Command "node"
Require-Command "npm"

New-Item -ItemType Directory -Force -Path $TargetRoot | Out-Null

$items = Get-ChildItem -LiteralPath $sourceRoot -Force | Where-Object {
    $_.Name -notin @("node_modules", ".git", "output", "tmp")
}

foreach ($item in $items) {
    Copy-Item -LiteralPath $item.FullName -Destination $TargetRoot -Recurse -Force
}

Push-Location $TargetRoot
try {
    if (-not (Test-Path -LiteralPath ".git")) {
        git init --initial-branch=main | Out-Host
    }

    if (-not (Test-Path -LiteralPath ".env")) {
        Copy-Item -LiteralPath ".env.example" -Destination ".env"
    }

    git status --short

    if (-not $SkipCodeOpen -and (Get-Command "code" -ErrorAction SilentlyContinue)) {
        code .
    }

    Write-Host "Projeto preparado em $TargetRoot" -ForegroundColor Green
    Write-Host "Próximo passo: abrir o Codex neste mesmo diretório e iniciar pela leitura de AGENTS.md e MEMORY.md."
}
finally {
    Pop-Location
}
