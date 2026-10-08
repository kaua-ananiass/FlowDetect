param([string]$Destino)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir 'nibo_automatico.mjs'

if (-not $Destino) {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Escolha a pasta privada para salvar as conversas do Nibo'
    if ($picker.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
    $Destino = $picker.SelectedPath
}

$Destino = [System.IO.Path]::GetFullPath($Destino)
if (-not (Test-Path -LiteralPath $Destino -PathType Container)) {
    New-Item -ItemType Directory -Path $Destino -Force | Out-Null
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js não encontrado no PATH.' }
$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw 'Este exportador precisa de Node.js 20 ou mais recente.' }
if (-not (Test-Path -LiteralPath (Join-Path $scriptDir 'node_modules\playwright-core'))) {
    npm ci --prefix $scriptDir
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar playwright-core.' }
}

node $nodeScript configurar $Destino
if ($LASTEXITCODE -ne 0) { throw 'Falha ao configurar a pasta.' }
node $nodeScript login
if ($LASTEXITCODE -ne 0) { throw 'O login não foi confirmado.' }
node $nodeScript calibrar
if ($LASTEXITCODE -ne 0) { throw 'A exportação CSV ainda não foi calibrada.' }

Write-Host 'Pronto. Faça um teste com: node scripts/nibo_automatico.mjs rodar'
Write-Host 'Depois registre a execução semanal com scripts/nibo_agendar.ps1.'
