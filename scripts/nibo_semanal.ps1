$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$answer = [System.Windows.Forms.MessageBox]::Show(
    'Deseja baixar as conversas do Nibo atualizadas nesta semana?',
    'FlowDetect - Conversas Nibo',
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question
)
if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir 'nibo_automatico.mjs'
& node $nodeScript rodar
$result = $LASTEXITCODE
if ($result -ne 0) {
    [System.Windows.Forms.MessageBox]::Show(
        'A exportação não terminou. Confira o relatório em relatorios_nibo na pasta configurada. Talvez seja necessário fazer login ou recalibrar o botão de exportação.',
        'FlowDetect - Exportação interrompida',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
}
exit $result
