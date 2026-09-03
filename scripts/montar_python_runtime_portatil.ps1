$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$SupportDir = Join-Path $ProjectRoot "tauri_gerador\src-tauri\installer_support"
$RuntimeDir = Join-Path $SupportDir "python_runtime_prebuilt"
$RuntimeZip = Join-Path $SupportDir "python-3.12.10-embeddable-amd64.zip"
$WheelsDir = Join-Path $SupportDir "python-wheels"
$Requirements = Join-Path $ProjectRoot "requirements.txt"
$GetPip = Join-Path $SupportDir "get-pip.py"

$ResolvedSupport = [System.IO.Path]::GetFullPath($SupportDir)
$ResolvedRuntime = [System.IO.Path]::GetFullPath($RuntimeDir)
if (-not $ResolvedRuntime.StartsWith($ResolvedSupport, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Runtime fora da pasta esperada: $ResolvedRuntime"
}

if (-not (Test-Path -LiteralPath $RuntimeZip)) {
  Invoke-WebRequest -Uri "https://www.python.org/ftp/python/3.12.10/python-3.12.10-embeddable-amd64.zip" -OutFile $RuntimeZip
}
if (-not (Test-Path -LiteralPath $Requirements)) {
  throw "requirements.txt nao encontrado: $Requirements"
}

if (Test-Path -LiteralPath $RuntimeDir) {
  Remove-Item -LiteralPath $RuntimeDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
Expand-Archive -LiteralPath $RuntimeZip -DestinationPath $RuntimeDir -Force

$PthFile = Join-Path $RuntimeDir "python312._pth"
if (Test-Path -LiteralPath $PthFile) {
  $Pth = Get-Content -Raw -Path $PthFile
  $Pth = $Pth -replace "#import site", "import site"
  if ($Pth -notmatch "Lib/site-packages") {
    $Pth = $Pth.TrimEnd() + "`r`nLib/site-packages`r`n"
  }
  [System.IO.File]::WriteAllText($PthFile, $Pth, [System.Text.Encoding]::ASCII)
}

$PythonExe = Join-Path $RuntimeDir "python.exe"
& $PythonExe --version

if (-not (Test-Path -LiteralPath $GetPip)) {
  Invoke-WebRequest -Uri "https://bootstrap.pypa.io/get-pip.py" -OutFile $GetPip
}

& $PythonExe $GetPip --no-warn-script-location
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$PipArgs = @("-m", "pip", "install", "--upgrade", "--no-index", "--find-links", $WheelsDir, "-r", $Requirements, "--prefer-binary", "--disable-pip-version-check")
& $PythonExe $PipArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

& $PythonExe -c "import openpyxl, pyautogui, cv2, PIL, pytesseract, reportlab, uiautomation; print('runtime-portatil-ok')"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Get-ChildItem -LiteralPath $RuntimeDir | Select-Object Name,Length | Format-Table
