[CmdletBinding()]
param([switch]$ConfirmSeal)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Execute este script como administrador dentro da VM de publicacao."
}
if (-not $ConfirmSeal) {
    throw "Esta operacao generaliza e desliga o Windows. Revise a VM e execute novamente com -ConfirmSeal."
}

Write-Host "Encerrando o FlowDetect Agent..." -ForegroundColor Cyan
Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match "FlowDetect.*Agent|flowdetect_agent"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Cada clone precisa criar um segredo de pareamento proprio no primeiro boot.
$agentIdentity = Join-Path $env:LOCALAPPDATA "FlowDetect\Agent\pairing.token"
Remove-Item -LiteralPath $agentIdentity -Force -ErrorAction SilentlyContinue

$sealDirectory = Join-Path $env:ProgramData "FlowDetect\GoldenImage"
New-Item -ItemType Directory -Path $sealDirectory -Force | Out-Null
[ordered]@{
    sealedAtUtc = [DateTime]::UtcNow.ToString("o")
    sourceComputerName = $env:COMPUTERNAME
    agentPairingIdentityRemoved = $true
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $sealDirectory "seal.json") -Encoding UTF8

$sysprep = Join-Path $env:WINDIR "System32\Sysprep\Sysprep.exe"
if (-not (Test-Path -LiteralPath $sysprep)) { throw "Sysprep nao encontrado: $sysprep" }

Write-Host "Generalizando o Windows. A VM sera desligada automaticamente..." -ForegroundColor Yellow
$process = Start-Process -FilePath $sysprep -ArgumentList "/oobe /generalize /shutdown /mode:vm" -Wait -PassThru
if ($process.ExitCode -ne 0) { throw "O Sysprep falhou com codigo $($process.ExitCode)." }
