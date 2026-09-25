$ErrorActionPreference = 'Stop'
$projectBase = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'Cargo nao encontrado. Instale o Rust antes de limpar os caches de build.'
}

if (Get-Process cargo, rustc -ErrorAction SilentlyContinue) {
    throw 'Aguarde a compilacao em andamento terminar antes de limpar os caches.'
}

$projects = @('tauri_gerador', 'flowdetect_agent')
foreach ($project in $projects) {
    $projectRoot = Join-Path $projectBase $project
    $cargoRoot = Join-Path $projectRoot 'src-tauri'
    $manifest = Join-Path $cargoRoot 'Cargo.toml'
    if (-not (Test-Path -LiteralPath $manifest)) {
        throw "Projeto nao encontrado: $manifest"
    }

    Push-Location -LiteralPath $cargoRoot
    try {
        & cargo clean
        if ($LASTEXITCODE -ne 0) {
            throw "Falha ao limpar o cache de $project"
        }
    }
    finally {
        Pop-Location
    }

    # A copia de build pode apontar para esta pasta por uma junction.
    New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'target') | Out-Null
    Write-Host "Cache limpo: $project"
}

Write-Host 'Caches de build limpos. Instaladores, automacoes e diagnosticos foram preservados.'
