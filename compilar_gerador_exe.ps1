$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tauriDir = Join-Path $root "tauri_gerador"
$outputRoot = Join-Path $root "saida_exe"
$packageDir = Join-Path $outputRoot "FlowDetect_Portatil"
$installerDir = Join-Path $outputRoot "FlowDetect_Instalador"
$targetRelease = Join-Path $tauriDir "target\release"
$bundleDir = Join-Path $targetRelease "bundle"
$installerSupportDir = Join-Path $tauriDir "src-tauri\installer_support"
$runtimeSeedDir = Join-Path $installerSupportDir "runtime_seed"
$runtimeSeedAutomationsDir = Join-Path $runtimeSeedDir "automacoes"
$pythonWheelDir = Join-Path $installerSupportDir "python-wheels"
$pythonVersion = "3.12.10"
$pythonInstallerName = "python-installer.exe"
$pythonInstallerPath = Join-Path $installerSupportDir $pythonInstallerName
$pythonInstallerUrl = "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-amd64.exe"
$buildPythonDir = Join-Path $installerSupportDir "build_python_$pythonVersion"
$buildPythonExe = Join-Path $buildPythonDir "python.exe"
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

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $directory = Split-Path -Parent $Path
    if ($directory) {
        Ensure-Directory $directory
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Invoke-AvailablePython {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory = $root
    )

    $candidates = @(
        @{ Program = "python"; Prefix = @() },
        @{ Program = "py"; Prefix = @("-3") }
    )

    foreach ($candidate in $candidates) {
        try {
            & $candidate.Program @($candidate.Prefix) --version *> $null
            if ($LASTEXITCODE -ne 0) {
                continue
            }

            Push-Location $WorkingDirectory
            try {
                & $candidate.Program @($candidate.Prefix) @Arguments 2>&1 | Out-Host
                $exitCode = $LASTEXITCODE
                return $exitCode
            } finally {
                Pop-Location
            }
        } catch {
            continue
        }
    }

    throw "Nao encontrei um Python compativel para preparar as dependencias offline do instalador."
}

function Ensure-BuildPython {
    if (Test-Path $buildPythonExe) {
        & $buildPythonExe --version *> $null
        if ($LASTEXITCODE -eq 0) {
            return
        }
    }

    if (Test-Path $buildPythonDir) {
        Remove-Item $buildPythonDir -Recurse -Force
    }

    if (-not (Test-Path $pythonInstallerPath)) {
        throw "Instalador do Python nao encontrado em '$pythonInstallerPath'."
    }

    Write-Host "Instalando Python $pythonVersion temporario para gerar wheels compativeis..." -ForegroundColor DarkCyan
    & $pythonInstallerPath /quiet InstallAllUsers=0 TargetDir="$buildPythonDir" AssociateFiles=0 PrependPath=0 AppendPath=0 Shortcuts=0 Include_doc=0 Include_test=0 Include_tools=0 Include_launcher=0 InstallLauncherAllUsers=0 Include_pip=1 Include_tcltk=1 | Out-Host
    if (Test-Path $buildPythonExe) {
        return
    }

    # O runtime portatil ja incluido no instalador tambem tem pip e todas as
    # bibliotecas necessarias. Ele permite gerar a release quando o instalador
    # temporario do Python for bloqueado por politica/antivirus do Windows.
    $portablePython = Join-Path $installerSupportDir "python_runtime_prebuilt\python.exe"
    if (Test-Path $portablePython) {
        & $portablePython --version *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Usando o Python portatil ja validado para gerar a release..." -ForegroundColor DarkCyan
            $script:buildPythonExe = $portablePython
            return
        }
    }

    throw "Nao foi possivel preparar o Python temporario em '$buildPythonDir'."
}

function Invoke-BuildPython {
    param(
        [string[]]$Arguments,
        [string]$WorkingDirectory = $root
    )

    Ensure-BuildPython
    Push-Location $WorkingDirectory
    try {
        & $buildPythonExe @Arguments 2>&1 | Out-Host
        return $LASTEXITCODE
    } finally {
        Pop-Location
    }
}

if (-not (Test-Path $npmCmd)) {
    throw "Nao encontrei o npm em '$npmCmd'. Instale o Node.js ou ajuste o caminho no script."
}

Write-Host "Preparando pasta de saida limpa..." -ForegroundColor Cyan
Ensure-Directory $outputRoot
if (Test-Path $packageDir) {
    Remove-Item $packageDir -Recurse -Force
}
if (Test-Path $installerDir) {
    Remove-Item $installerDir -Recurse -Force
}
Ensure-Directory $packageDir
Ensure-Directory $installerDir
Ensure-Directory $installerSupportDir
Ensure-Directory $runtimeSeedDir
Ensure-Directory $runtimeSeedAutomationsDir

Write-Host "Gerando runtime limpo do FlowDetect..." -ForegroundColor Cyan
$cleanRoadmap = @'
{
  "criado_em": "2026-07-03T00:00:00",
  "instrucoes": [
    "Teclas simples e atalhos sao gravados individualmente.",
    "F8 abre uma caixa de texto grande e salva o bloco como um unico comando.",
    "O botao Capturar mouse salva a coordenada exata do proximo clique.",
    "Cada evento tambem salva o intervalo em segundos desde a acao anterior.",
    "A aba Planilha pode adicionar uma sequencia inteira ou so linhas selecionadas ao roteiro.",
    "Backspace remove a ultima entrada salva e F9 ou ESC encerram a captura."
  ],
  "resumo_digitado": "",
  "eventos": [],
  "sequencia_inicial": "principal",
  "configuracoes_sequencia": {}
}
'@
$cleanLibrary = @'
{
  "items": []
}
'@
Write-Utf8File -Path (Join-Path $runtimeSeedDir "mapeamento_teclado.json") -Content $cleanRoadmap
Write-Utf8File -Path (Join-Path $runtimeSeedDir "resumo_teclado.txt") -Content ""
Write-Utf8File -Path (Join-Path $runtimeSeedAutomationsDir "biblioteca.json") -Content $cleanLibrary

Write-Host "Preparando Python offline e cache local das bibliotecas..." -ForegroundColor Cyan
if ((-not (Test-Path $pythonInstallerPath)) -or ((Get-Item $pythonInstallerPath).Length -lt 1MB)) {
    Write-Host "Baixando instalador oficial do Python $pythonVersion..." -ForegroundColor DarkCyan
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $pythonInstallerUrl -OutFile $pythonInstallerPath
}

if (Test-Path $pythonWheelDir) {
    Remove-Item $pythonWheelDir -Recurse -Force
}
Ensure-Directory $pythonWheelDir

$requirementsPath = Join-Path $root "requirements.txt"
$downloadExit = Invoke-BuildPython -Arguments @(
    "-m",
    "pip",
    "download",
    "--dest",
    $pythonWheelDir,
    "-r",
    $requirementsPath,
    "--disable-pip-version-check"
)
if ($downloadExit -ne 0) {
    throw "Falha ao baixar as wheels Python para o pacote offline do instalador."
}

$packagingToolsExit = Invoke-BuildPython -Arguments @(
    "-m",
    "pip",
    "download",
    "--dest",
    $pythonWheelDir,
    "pip",
    "setuptools",
    "wheel",
    "--disable-pip-version-check"
)
if ($packagingToolsExit -ne 0) {
    throw "Falha ao baixar pip/setuptools/wheel para o pacote offline do instalador."
}

$sourceDistributions = Get-ChildItem -Path $pythonWheelDir -File | Where-Object {
    $_.Name -match "\.(tar\.gz|zip)$"
}

if ($sourceDistributions.Count -gt 0) {
    $wheelBuildArguments = @(
        "-m",
        "pip",
        "wheel",
        "--wheel-dir",
        $pythonWheelDir,
        "--no-deps",
        "--no-build-isolation",
        "--disable-pip-version-check"
    )
    $wheelBuildArguments += $sourceDistributions.FullName
    $wheelBuildArguments = $wheelBuildArguments | Where-Object { $_ -ne "--no-build-isolation" }
    $wheelBuildExit = Invoke-BuildPython -Arguments $wheelBuildArguments

    if ($wheelBuildExit -ne 0) {
        throw "Falha ao converter dependencias Python offline em wheels instalaveis."
    }

    Remove-Item $sourceDistributions.FullName -Force
}

Write-Host "Compilando o Gerador em modo release..." -ForegroundColor Cyan
Push-Location $tauriDir
try {
    & $npmCmd run tauri:build -- --bundles nsis
    if ($LASTEXITCODE -ne 0) {
        throw "A compilacao do Gerador falhou com codigo $LASTEXITCODE."
    }
} finally {
    Pop-Location
}

$exeCandidates = @(
    (Join-Path $targetRelease "FlowDetect.exe"),
    (Join-Path $targetRelease "gerador_automacao.exe"),
    (Join-Path $targetRelease "Gerador de Automacoes.exe"),
    (Join-Path $targetRelease "GeradorAutomacao.exe")
)

$exeSource = $exeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $exeSource) {
    throw "Nao foi encontrado o executavel do Gerador apos a compilacao."
}

Write-Host "Montando pacote final..." -ForegroundColor Cyan
$exeDestino = Join-Path $packageDir "FlowDetect.exe"
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
    "capturar_imagem_tela.py",
    "capturar_mouse_global.py",
    "diagnostico_ambiente.py",
    "executar_automacao.py",
    "executar_automacao.bat",
    "gerenciar_roteiro.py",
    "gerenciar_dados_planilha.py",
    "listar_janelas_abertas.py",
    "comandos_teclado.py",
    "validar_dependencias_instaladas.py",
    "requirements.txt",
    "instalar_dependencias_silencioso.bat",
    "README_AGENTE.md",
    "mapeamento_teclado.json"
)

foreach ($item in $itemsToCopy) {
    $source = Join-Path $root $item
    Copy-PathIfExists -Source $source -Destination $packageDir
}

Copy-PathIfExists -Source (Join-Path $root "hyperv_setup") -Destination $packageDir

Copy-PathIfExists -Source (Join-Path $runtimeSeedDir "mapeamento_teclado.json") -Destination $packageDir
Copy-PathIfExists -Source (Join-Path $runtimeSeedDir "resumo_teclado.txt") -Destination $packageDir
Copy-PathIfExists -Source $runtimeSeedAutomationsDir -Destination $packageDir
Ensure-Directory (Join-Path $packageDir "imagens")
Ensure-Directory (Join-Path $packageDir "planilhas")

Copy-PathIfExists -Source $pythonInstallerPath -Destination (Join-Path $packageDir $pythonInstallerName)
Copy-PathIfExists -Source $pythonWheelDir -Destination $packageDir

$authConfigSource = Join-Path $root "tauri_gerador\web\auth-config.js"
if (Test-Path $authConfigSource) {
    Copy-Item $authConfigSource -Destination (Join-Path $packageDir "auth-config.js") -Force
    $authConfigNestedDir = Join-Path $packageDir "tauri_gerador\web"
    Ensure-Directory $authConfigNestedDir
    Copy-Item $authConfigSource -Destination (Join-Path $authConfigNestedDir "auth-config.js") -Force
}

$installDepsBat = @'
@echo off
setlocal
cd /d "%~dp0"
echo Preparando Python local e dependencias do FlowDetect...
call "%~dp0instalar_dependencias_silencioso.bat"
echo.
if errorlevel 1 (
  echo A preparacao automatica falhou.
  pause
  exit /b 1
)
echo Dependencias finalizadas com sucesso.
pause
'@

Set-Content -Path (Join-Path $packageDir "instalar_dependencias.bat") -Value $installDepsBat -Encoding ASCII

$runVbs = @'
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run Chr(34) & shell.CurrentDirectory & "\FlowDetect.exe" & Chr(34), 1, False
'@

Set-Content -Path (Join-Path $packageDir "abrir_gerador.vbs") -Value $runVbs -Encoding UTF8

$installerExe = Get-ChildItem -Path (Join-Path $bundleDir "nsis") -Filter *.exe -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($installerExe) {
    Copy-Item $installerExe.FullName -Destination (Join-Path $installerDir $installerExe.Name) -Force
}

$guide = @"
FLOWDETECT COMPILADO
====================

Arquivo principal:
- FlowDetect.exe

Pasta final:
- $packageDir

Instalador real do Windows:
- $installerDir

Como usar nesta pasta:
1. Para a experiencia de instalacao completa, use o setup em:
   $installerDir
2. Nesta pasta portatil, se quiser so instalar as dependencias rapidamente, execute instalar_dependencias.bat.
3. Abra FlowDetect.exe ou abrir_gerador.vbs.
4. As automacoes, imagens e planilhas continuam nesta mesma pasta.

Arquivos importantes mantidos no pacote:
- automacoes\
- planilhas\
- imagens\
- executar_automacao.py
- gerenciar_roteiro.py
- gerenciar_dados_planilha.py

Observacao importante:
- Este pacote sai limpo: sem automacoes prontas, sem imagens salvas e sem planilhas de exemplo.
- A biblioteca interna ja vai zerada e pronta para o primeiro uso.
- O instalador NSIS agora gera um setup visual do FlowDetect.
- O setup agora leva um instalador offline do Python e um cache local das wheels do requirements.txt.
- Isso permite preparar a maquina de destino mesmo sem Python instalado previamente.
- O .exe do gerador foi compilado, mas a execucao das automacoes continua usando os scripts Python do projeto e o runtime local instalado pelo setup.

Pastas de build originais:
- $targetRelease
- $bundleDir
- $installerSupportDir
"@

Set-Content -Path (Join-Path $packageDir "COMO_EXECUTAR_GERADOR.txt") -Value $guide -Encoding UTF8

Write-Host ""
Write-Host "Compilacao concluida com sucesso." -ForegroundColor Green
Write-Host "Pasta final:" -ForegroundColor Green
Write-Host $packageDir -ForegroundColor Yellow

if (Test-Path $buildPythonDir) {
    Remove-Item $buildPythonDir -Recurse -Force
}
