$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tauriDir = Join-Path $root "tauri_gerador"
$outputRoot = Join-Path $root "saida_exe"
$packageDir = Join-Path $outputRoot "Gerador_de_Automacoes"
$targetRelease = Join-Path $tauriDir "src-tauri\target\release"
$bundleDir = Join-Path $targetRelease "bundle"
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

function Copy-PathIfExists {
    param(
        [string]$Source,
        [string]$Destination
    )

    if (-not (Test-Path $Source)) {
        return
    }

    if (Test-Path $Source -PathType Container) {
        Copy-Item $Source -Destination $Destination -Recurse -Force
        return
    }

    Copy-Item $Source -Destination $Destination -Force
}

function Ensure-Directory {
    param([string]$Path)
    New-Item -ItemType Directory -Force -Path $Path | Out-Null
}

if (-not (Test-Path $npmCmd)) {
    throw "Nao encontrei o npm em '$npmCmd'. Instale o Node.js ou ajuste o caminho no script."
}

Write-Host "Preparando pasta de saida limpa..." -ForegroundColor Cyan
Ensure-Directory $outputRoot
if (Test-Path $packageDir) {
    Remove-Item $packageDir -Recurse -Force
}
Ensure-Directory $packageDir

Write-Host "Compilando o Gerador em modo release..." -ForegroundColor Cyan
Push-Location $tauriDir
try {
    & $npmCmd run tauri:build -- --no-bundle
    if ($LASTEXITCODE -ne 0) {
        throw "A compilacao do Gerador falhou com codigo $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

$exeCandidates = @(
    (Join-Path $targetRelease "Gerador de Automacoes.exe"),
    (Join-Path $targetRelease "gerador_automacao.exe"),
    (Join-Path $targetRelease "GeradorAutomacao.exe")
)

$exeSource = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exeSource) {
    throw "Nao foi encontrado o executavel do Gerador apos a compilacao."
}

Write-Host "Montando pacote final..." -ForegroundColor Cyan
$exeDestino = Join-Path $packageDir "Gerador de Automacoes.exe"
Copy-Item $exeSource $exeDestino -Force

$sidecarFiles = @(
    "WebView2Loader.dll"
)

foreach ($sidecar in $sidecarFiles) {
    $sidecarPath = Join-Path $targetRelease $sidecar
    Copy-PathIfExists -Source $sidecarPath -Destination $packageDir
}

$itemsToCopy = @(
    "capturar_cliques.py",
    "capturar_mouse_global.py",
    "executar_automacao.py",
    "executar_automacao.bat",
    "gerenciar_roteiro.py",
    "gerenciar_dados_planilha.py",
    "listar_janelas_abertas.py",
    "comandos_teclado.py",
    "requirements.txt",
    "COMO USAR.txt",
    "db.xlsx",
    "mapeamento_teclado.json",
    "resumo_teclado.txt",
    "imagens",
    "planilhas",
    "automacoes"
)

foreach ($item in $itemsToCopy) {
    $source = Join-Path $root $item
    Copy-PathIfExists -Source $source -Destination $packageDir
}

$installDepsBat = @'
@echo off
setlocal
echo Instalando dependencias Python do gerador...
python -m pip install -r requirements.txt
if errorlevel 1 (
  py -3 -m pip install -r requirements.txt
)
echo.
echo Dependencias finalizadas.
pause
'@

Set-Content -Path (Join-Path $packageDir "instalar_dependencias.bat") -Value $installDepsBat -Encoding ASCII

$runBat = @'
@echo off
setlocal
start "" "Gerador de Automacoes.exe"
'@

Set-Content -Path (Join-Path $packageDir "abrir_gerador.bat") -Value $runBat -Encoding ASCII

$guide = @"
GERADOR COMPILADO
=================

Arquivo principal:
- Gerador de Automacoes.exe

Pasta final:
- $packageDir

Como usar nesta pasta:
1. Se ainda nao tiver Python e as bibliotecas instaladas, execute instalar_dependencias.bat.
2. Abra Gerador de Automacoes.exe ou abrir_gerador.bat.
3. As automacoes, imagens e planilhas continuam nesta mesma pasta.

Arquivos importantes mantidos no pacote:
- automacoes\
- planilhas\
- imagens\
- executar_automacao.py
- gerenciar_roteiro.py
- gerenciar_dados_planilha.py

Observacao importante:
- O .exe do gerador foi compilado, mas a execucao das automacoes continua usando os scripts Python do projeto.
- Por isso, este pacote ja leva os scripts e o requirements.txt juntos.

Pastas de build originais:
- $targetRelease
- $bundleDir
"@

Set-Content -Path (Join-Path $packageDir "COMO_EXECUTAR_GERADOR.txt") -Value $guide -Encoding UTF8

Write-Host ""
Write-Host "Compilacao concluida com sucesso." -ForegroundColor Green
Write-Host "Pasta final:" -ForegroundColor Green
Write-Host $packageDir -ForegroundColor Yellow
