@echo off
setlocal
cd /d "%~dp0"

if exist "Automacao.exe" (
    start "" "%~dp0Automacao.exe"
    endlocal
    exit /b 0
)

if exist "tauri_ui\src-tauri\target\release\automacao_tauri_ui.exe" (
    start "" "%~dp0tauri_ui\src-tauri\target\release\automacao_tauri_ui.exe"
    endlocal
    exit /b 0
)

if exist "tauri_ui\src-tauri\target\release\Automacao.exe" (
    start "" "%~dp0tauri_ui\src-tauri\target\release\Automacao.exe"
    endlocal
    exit /b 0
)

set "PYTHON_CMD=python"
where pythonw >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=pythonw"
)
where pyw >nul 2>&1
if not errorlevel 1 (
    set "PYTHON_CMD=pyw -3"
)
if "%PYTHON_CMD%"=="python" (
    where py >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_CMD=py -3"
    )
)

if not exist "interface_automacao.py" (
    echo Arquivo interface_automacao.py nao encontrado.
    pause
    endlocal
    exit /b 1
)

call %PYTHON_CMD% interface_automacao.py
endlocal
