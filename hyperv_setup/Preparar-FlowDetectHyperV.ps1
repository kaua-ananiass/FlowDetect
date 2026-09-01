[CmdletBinding()]
param(
    [string]$ManifestPath = (Join-Path $PSScriptRoot "golden-vm.json"),
    [string]$PackagePath = "",
    [string]$TargetUser = "",
    [switch]$Quiet,
    [switch]$NoElevation
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Quote-Argument([string]$Value) {
    return '"' + $Value.Replace('"', '\"') + '"'
}

function Relaunch-Elevated {
    if (-not $TargetUser) { $script:TargetUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name }
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Quote-Argument $PSCommandPath), "-ManifestPath", (Quote-Argument $ManifestPath), "-TargetUser", (Quote-Argument $TargetUser), "-NoElevation")
    if ($PackagePath) { $arguments += @("-PackagePath", (Quote-Argument $PackagePath)) }
    if ($Quiet) { $arguments += "-Quiet" }
    $process = Start-Process -FilePath "powershell.exe" -ArgumentList ($arguments -join " ") -Verb RunAs -Wait -PassThru
    exit $process.ExitCode
}

function Register-ResumeTask {
    $taskName = "FlowDetect-ContinueHyperVSetup"
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", (Quote-Argument $PSCommandPath), "-ManifestPath", (Quote-Argument $ManifestPath), "-TargetUser", (Quote-Argument $TargetUser), "-NoElevation")
    if ($PackagePath) { $arguments += @("-PackagePath", (Quote-Argument $PackagePath)) }
    if ($Quiet) { $arguments += "-Quiet" }
    $action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument ($arguments -join " ")
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $TargetUser
    $principal = New-ScheduledTaskPrincipal -UserId $TargetUser -LogonType Interactive -RunLevel Highest
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Description "Retoma a preparacao do Hyper-V para o FlowDetect" -Force | Out-Null
}

function Remove-ResumeTask {
    Unregister-ScheduledTask -TaskName "FlowDetect-ContinueHyperVSetup" -Confirm:$false -ErrorAction SilentlyContinue
}

function Write-Step([string]$Message) {
    Write-Host "[FlowDetect] $Message" -ForegroundColor Cyan
}

function Select-GoldenPackage {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = [Windows.Forms.OpenFileDialog]::new()
    $dialog.Title = "Selecione o pacote da VM-base do FlowDetect"
    $dialog.Filter = "Pacote FlowDetect (*.zip)|*.zip|Todos os arquivos (*.*)|*.*"
    if ($dialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) { return $dialog.FileName }
    return ""
}

if (-not (Test-Administrator)) {
    if ($NoElevation) { throw "O assistente precisa de permissao de administrador." }
    Relaunch-Elevated
}

if (-not $TargetUser) { $TargetUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name }

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    throw "Manifesto da VM-base nao encontrado: $ManifestPath"
}
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json

$edition = (Get-ComputerInfo -Property WindowsProductName).WindowsProductName
if ($edition -match " Home") {
    throw "O Hyper-V nao e suportado nesta edicao do Windows ($edition). Use Windows Pro, Enterprise ou Education."
}

Write-Step "Verificando o Hyper-V..."
$feature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All
if ($feature.State -ne "Enabled") {
    $result = Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -All -NoRestart
    if ($result.RestartNeeded) {
        Register-ResumeTask
        Write-Host "O Hyper-V foi habilitado. Reinicie o computador; o assistente FlowDetect continuara automaticamente no proximo login." -ForegroundColor Yellow
        exit 3010
    }
}

Import-Module Hyper-V -ErrorAction Stop
$computer = Get-CimInstance Win32_ComputerSystem
if (-not $computer.HypervisorPresent) {
    Register-ResumeTask
    Write-Host "O Hyper-V esta instalado, mas o hipervisor ainda nao iniciou. Reinicie o computador; o assistente continuara automaticamente." -ForegroundColor Yellow
    exit 3010
}

Write-Step "Configurando permissoes do usuario e sessao aprimorada..."
$hyperVGroup = Get-LocalGroup -SID "S-1-5-32-578"
if (-not (Get-LocalGroupMember -Group $hyperVGroup.Name -ErrorAction SilentlyContinue | Where-Object Name -eq $TargetUser)) {
    Add-LocalGroupMember -Group $hyperVGroup.Name -Member $TargetUser
}
Set-VMHost -EnableEnhancedSessionMode $true

$existing = Get-VM -Name ([string]$manifest.vmName) -ErrorAction SilentlyContinue
if ($existing) {
    Remove-ResumeTask
    Write-Host "A VM '$($manifest.vmName)' ja existe. O assistente preservou a instalacao atual." -ForegroundColor Green
    Write-Host "Preparacao concluida. Faca logoff e login se o usuario acabou de receber permissao do Hyper-V." -ForegroundColor Green
    exit 0
}

if (-not $PackagePath) {
    $besideManifest = Join-Path (Split-Path -Parent $ManifestPath) ([string]$manifest.archiveName)
    if (Test-Path -LiteralPath $besideManifest) { $PackagePath = $besideManifest }
}

if (-not $PackagePath -and [string]$manifest.downloadUrl) {
    $downloadDirectory = Join-Path $env:ProgramData "FlowDetect\Downloads"
    New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
    $PackagePath = Join-Path $downloadDirectory ([string]$manifest.archiveName)
    Write-Step "Baixando a VM-base global..."
    Invoke-WebRequest -Uri ([string]$manifest.downloadUrl) -OutFile $PackagePath -UseBasicParsing
}

if (-not $PackagePath -and -not $Quiet) { $PackagePath = Select-GoldenPackage }
if (-not $PackagePath) {
    throw "O pacote da VM-base nao foi informado. Coloque '$($manifest.archiveName)' ao lado do manifesto ou configure downloadUrl."
}
if (-not (Test-Path -LiteralPath $PackagePath)) { throw "Pacote da VM-base nao encontrado: $PackagePath" }

if ([string]$manifest.sha256) {
    Write-Step "Validando a integridade do pacote..."
    $actualHash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash
    if ($actualHash -ne [string]$manifest.sha256) { throw "SHA-256 invalido para o pacote da VM-base." }
}

$drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($env:ProgramData).TrimEnd(':'))
$requiredBytes = [int64]$manifest.minimumFreeSpaceGB * 1GB
if ($drive.Free -lt $requiredBytes) {
    throw "Espaco insuficiente. A instalacao requer pelo menos $($manifest.minimumFreeSpaceGB) GB livres."
}

$imageDirectory = Join-Path $env:ProgramData "FlowDetect\GoldenImages\$($manifest.imageId)\$($manifest.version)"
if (-not (Test-Path -LiteralPath $imageDirectory)) {
    Write-Step "Extraindo a golden image..."
    New-Item -ItemType Directory -Path $imageDirectory -Force | Out-Null
    Expand-Archive -LiteralPath $PackagePath -DestinationPath $imageDirectory -Force
}

$vmcx = Get-ChildItem -LiteralPath $imageDirectory -Recurse -Filter *.vmcx -File | Select-Object -First 1
if (-not $vmcx) { throw "O pacote nao contem uma configuracao Hyper-V .vmcx valida." }

$destination = Join-Path $env:ProgramData "FlowDetect\HyperV\$($manifest.vmName)"
$vhdDestination = Join-Path $destination "Virtual Hard Disks"
$snapshotDestination = Join-Path $destination "Snapshots"
New-Item -ItemType Directory -Path $vhdDestination,$snapshotDestination -Force | Out-Null

Write-Step "Importando a VM-base com identidade independente..."
$report = Compare-VM -Path $vmcx.FullName -Copy -GenerateNewId -VirtualMachinePath $destination -VhdDestinationPath $vhdDestination -SnapshotFilePath $snapshotDestination -SmartPagingFilePath $destination
Get-VMNetworkAdapter -VM $report.VM -ErrorAction SilentlyContinue | Disconnect-VMNetworkAdapter -ErrorAction SilentlyContinue
$imported = Import-VM -CompatibilityReport $report

if ($imported.Name -ne [string]$manifest.vmName) {
    Rename-VM -VM $imported -NewName ([string]$manifest.vmName)
    $imported = Get-VM -Name ([string]$manifest.vmName)
}

$defaultSwitch = Get-VMSwitch -Name "Default Switch" -ErrorAction SilentlyContinue
if (-not $defaultSwitch) { throw "A VM foi importada, mas o Default Switch do Hyper-V nao foi encontrado." }
Get-VMNetworkAdapter -VM $imported | Connect-VMNetworkAdapter -SwitchName $defaultSwitch.Name
Set-VM -VM $imported -EnhancedSessionTransportType VMBus -AutomaticStartAction Nothing -AutomaticStopAction ShutDown
Get-VMIntegrationService -VM $imported | Where-Object Name -Match "Guest|Convidado" | Enable-VMIntegrationService

$installedManifestDirectory = Join-Path $env:ProgramData "FlowDetect\GoldenImages\installed"
New-Item -ItemType Directory -Path $installedManifestDirectory -Force | Out-Null
$installed = [ordered]@{
    imageId = [string]$manifest.imageId
    version = [string]$manifest.version
    vmName = $imported.Name
    vmId = $imported.Id.Guid
    installedAtUtc = [DateTime]::UtcNow.ToString("o")
}
$installed | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $installedManifestDirectory "$($manifest.imageId).json") -Encoding UTF8

Remove-ResumeTask
Write-Host "FlowDetect preparado. VM '$($imported.Name)' importada com sucesso." -ForegroundColor Green
Write-Host "Faca logoff e login antes de usar a tela integrada se esta foi a primeira configuracao deste usuario." -ForegroundColor Yellow
