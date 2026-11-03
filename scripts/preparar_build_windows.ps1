param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$support = Join-Path $projectRoot 'tauri_gerador\src-tauri\installer_support'
$installer = Join-Path $support 'python-installer.exe'
$expectedHash = '67B5635E80EA51072B87941312D00EC8927C4DB9BA18938F7AD2D27B328B95FB'
if (-not (Test-Path -LiteralPath $installer)) {
    if ($CheckOnly) { throw 'Falta python-installer.exe. Execute este script sem -CheckOnly para baixar o instalador oficial.' }
    $download = Join-Path $support 'python-installer.download'
    Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe' -OutFile $download
    if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expectedHash) { throw 'SHA256 do instalador Python diferente do esperado. O arquivo nao sera usado.' }
    Move-Item -LiteralPath $download -Destination $installer
}
if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Instalador Python existente com SHA256 diferente do esperado.' }
foreach ($relative in @('Tesseract-OCR\tesseract.exe','python_runtime_prebuilt\python.exe','python_runtime_prebuilt\python312.dll','python-wheels','runtime_seed\mapeamento_teclado.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $support $relative))) { throw "Recurso ausente: $relative" }
}
Write-Host 'Recursos de build Windows presentes; instalador Python verificado por SHA256.'
