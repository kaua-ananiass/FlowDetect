$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$RuntimeDir = Join-Path $ProjectRoot "tauri_gerador\src-tauri\installer_support\python_runtime_prebuilt"
$ResolvedRuntime = [System.IO.Path]::GetFullPath($RuntimeDir)
$ExpectedSuffix = "tauri_gerador\src-tauri\installer_support\python_runtime_prebuilt"

if (-not $ResolvedRuntime.EndsWith($ExpectedSuffix, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Runtime inesperado: $ResolvedRuntime"
}
if (-not (Test-Path -LiteralPath $RuntimeDir)) {
  throw "Runtime nao encontrado: $RuntimeDir"
}

$DirsToRemove = Get-ChildItem -LiteralPath $RuntimeDir -Recurse -Directory -Force |
  Where-Object {
    $_.Name -in @("__pycache__", "tests", "test") -or
    $_.Name.EndsWith(".dist-info", [System.StringComparison]::OrdinalIgnoreCase) -or
    $_.Name.EndsWith(".egg-info", [System.StringComparison]::OrdinalIgnoreCase)
  }

foreach ($Dir in $DirsToRemove) {
  Remove-Item -LiteralPath $Dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
}

$FilesToRemove = Get-ChildItem -LiteralPath $RuntimeDir -Recurse -File -Force |
  Where-Object { $_.Extension -in @(".pyc", ".pyo") }

foreach ($File in $FilesToRemove) {
  Remove-Item -LiteralPath $File.FullName -Force -ErrorAction SilentlyContinue
}

$PythonExe = Join-Path $RuntimeDir "python.exe"
& $PythonExe -c "import openpyxl, pyautogui, cv2, PIL, pytesseract, reportlab, uiautomation; print('runtime-ok')"
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$Total = (Get-ChildItem -LiteralPath $RuntimeDir -Recurse -File | Measure-Object Length -Sum).Sum
[pscustomobject]@{
  Runtime = $RuntimeDir
  RemovedDirectories = $DirsToRemove.Count
  RemovedFiles = $FilesToRemove.Count
  MB = [math]::Round($Total / 1MB, 2)
} | Format-List
