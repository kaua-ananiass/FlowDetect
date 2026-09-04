param(
  [string]$Url = "https://github.com/tesseract-ocr/tesseract/releases/download/5.5.3/tesseract-ocr-w64-setup-5.5.3.20260724.exe"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$targetDir = Join-Path $scriptDir "Tesseract-OCR"
$downloadDir = Join-Path ([System.IO.Path]::GetTempPath()) "flowdetect-tesseract-ocr"
$installerPath = Join-Path $downloadDir "tesseract-installer.exe"

New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$tesseractExe = Join-Path $targetDir "tesseract.exe"
if (Test-Path -LiteralPath $tesseractExe) {
  Write-Host "[FlowDetect] Tesseract OCR ja existe em: $targetDir"
  & $tesseractExe --version
  if ($LASTEXITCODE -eq 0) {
    Write-Host "[FlowDetect] Tesseract OCR pronto para ser empacotado na build."
    exit 0
  }
  Write-Host "[FlowDetect] Tesseract existente falhou na validacao. Recriando..."
}

Write-Host "[FlowDetect] Baixando Tesseract OCR..."
Write-Host "[FlowDetect] Origem: $Url"
Invoke-WebRequest `
  -Uri $Url `
  -OutFile $installerPath `
  -Headers @{ "User-Agent" = "Mozilla/5.0 Windows NT 10.0; Win64; x64 FlowDetectBuild/1.0" }

Write-Host "[FlowDetect] Instalando runtime portatil em: $targetDir"
$arguments = @(
  "/VERYSILENT",
  "/SUPPRESSMSGBOXES",
  "/NORESTART",
  "/SP-",
  "/DIR=$targetDir"
)

$process = Start-Process -FilePath $installerPath -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
if ($process.ExitCode -ne 0) {
  throw "Instalador do Tesseract terminou com codigo $($process.ExitCode)."
}

if (-not (Test-Path -LiteralPath $tesseractExe)) {
  $fallbackDirs = New-Object System.Collections.Generic.List[string]
  if ($env:ProgramFiles) {
    $candidate = Join-Path $env:ProgramFiles "Tesseract-OCR"
    if (Test-Path -LiteralPath (Join-Path $candidate "tesseract.exe")) {
      $fallbackDirs.Add($candidate)
    }
  }
  $programFilesX86 = [Environment]::GetEnvironmentVariable("ProgramFiles(x86)")
  if ($programFilesX86) {
    $candidate = Join-Path $programFilesX86 "Tesseract-OCR"
    if (Test-Path -LiteralPath (Join-Path $candidate "tesseract.exe")) {
      $fallbackDirs.Add($candidate)
    }
  }

  if ($fallbackDirs.Count -lt 1) {
    throw "tesseract.exe nao foi encontrado em $targetDir depois da instalacao."
  }

  $installedDir = [string]$fallbackDirs[0]
  Write-Host "[FlowDetect] Instalador usou outro destino. Copiando de: $installedDir"
  Copy-Item -Path (Join-Path $installedDir "*") -Destination $targetDir -Recurse -Force
  $tesseractExe = Join-Path $targetDir "tesseract.exe"
  if (-not (Test-Path -LiteralPath $tesseractExe)) {
    throw "tesseract.exe nao foi encontrado em $targetDir depois da copia."
  }
}

Write-Host "[FlowDetect] Validando Tesseract..."
& $tesseractExe --version
if ($LASTEXITCODE -ne 0) {
  throw "Tesseract foi copiado, mas falhou ao abrir."
}

Write-Host "[FlowDetect] Tesseract OCR pronto para ser empacotado na build."
