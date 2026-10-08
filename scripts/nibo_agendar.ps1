param(
    [ValidateSet('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')]
    [string]$Dia = 'Monday',
    [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')]
    [string]$Hora = '09:00'
)

$ErrorActionPreference = 'Stop'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir 'nibo_semanal.ps1'
$config = Join-Path $env:LOCALAPPDATA 'FlowDetect\Nibo\config.json'
if (-not (Test-Path -LiteralPath $config -PathType Leaf)) { throw 'Execute nibo_configurar.ps1 primeiro.' }

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}"' -f $runner) `
    -WorkingDirectory $scriptDir
$at = [datetime]::ParseExact($Hora, 'HH:mm', [Globalization.CultureInfo]::InvariantCulture)
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Dia -At $at
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable `
    -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 12)

Register-ScheduledTask -TaskName 'FlowDetect - Nibo conversas semanal' `
    -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Write-Host "Agendado para $Dia às $Hora. A pergunta Sim/Não aparecerá quando você estiver conectado ao Windows."
