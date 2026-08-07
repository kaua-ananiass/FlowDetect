$ErrorActionPreference = "SilentlyContinue"

$targets = @(
    "tauri_gerador\src-tauri\target",
    "flowdetect_agent\src-tauri\target",
    "diagnosticos_reconhecimento",
    "__pycache__"
)

foreach ($target in $targets) {
    if (Test-Path $target) {
        Remove-Item -LiteralPath $target -Recurse -Force
        Write-Host "Removido: $target"
    }
    else {
        Write-Host "Nao encontrado: $target"
    }
}

Write-Host ""
Write-Host "Limpeza concluida."
