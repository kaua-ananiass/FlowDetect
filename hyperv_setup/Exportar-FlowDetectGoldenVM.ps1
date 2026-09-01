[CmdletBinding()]
param(
    [string]$VmName = "BASE - VM",
    [string]$ManifestPath = (Join-Path $PSScriptRoot "golden-vm.json"),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "dist"),
    [switch]$SkipArchive
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Abra o PowerShell como administrador para exportar a VM-base."
    }
}

Assert-Administrator
Import-Module Hyper-V -ErrorAction Stop

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Manifesto da golden image nao encontrado: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$vm = Get-VM -Name $VmName -ErrorAction Stop
if ($vm.State -ne "Off") {
    throw "Desligue completamente a VM '$VmName' antes da exportacao. Estado atual: $($vm.State)."
}

$imageRoot = Join-Path $OutputDirectory "$($manifest.imageId)-$($manifest.version)"
$exportRoot = Join-Path $imageRoot "export"
if (Test-Path -LiteralPath $imageRoot) {
    throw "A saida ja existe: $imageRoot. Mova-a ou escolha outro diretorio."
}

New-Item -ItemType Directory -Path $exportRoot -Force | Out-Null
Write-Host "Exportando '$VmName'..." -ForegroundColor Cyan
Export-VM -VM $vm -Path $exportRoot

$metadata = [ordered]@{
    schemaVersion = 1
    imageId = [string]$manifest.imageId
    version = [string]$manifest.version
    sourceVmName = $vm.Name
    sourceVmId = $vm.Id.Guid
    exportedAtUtc = [DateTime]::UtcNow.ToString("o")
    configurationVersion = [string]$vm.Version
    generation = $vm.Generation
}
$metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $imageRoot "image-metadata.json") -Encoding UTF8
Copy-Item -LiteralPath $ManifestPath -Destination (Join-Path $imageRoot "golden-vm.json") -Force

if ($SkipArchive) {
    Write-Host "Golden image criada em: $imageRoot" -ForegroundColor Green
    exit 0
}

$archivePath = Join-Path $OutputDirectory ([string]$manifest.archiveName)
if (Test-Path -LiteralPath $archivePath) {
    throw "O arquivo ja existe: $archivePath"
}

Write-Host "Compactando a golden image. Isso pode demorar..." -ForegroundColor Cyan
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if (-not $tar) {
    throw "O tar.exe do Windows nao foi encontrado. Use -SkipArchive e distribua a pasta exportada."
}
Push-Location $OutputDirectory
try {
    & $tar.Source -a -c -f $archivePath (Split-Path -Leaf $imageRoot)
    if ($LASTEXITCODE -ne 0) { throw "Falha ao criar o pacote ZIP da golden image." }
} finally {
    Pop-Location
}

$hash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
$releaseManifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$releaseManifest.sha256 = $hash
$releaseManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutputDirectory "golden-vm.json") -Encoding UTF8

Write-Host "Pacote criado: $archivePath" -ForegroundColor Green
Write-Host "SHA-256: $hash" -ForegroundColor Green
Write-Host "Publique o ZIP e o golden-vm.json gerado no mesmo release." -ForegroundColor Yellow
