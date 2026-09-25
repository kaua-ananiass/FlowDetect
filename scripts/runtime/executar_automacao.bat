@echo off
setlocal
set "FLOW_BASE=%~dp0"
if exist "%~dp0..\..\executar_automacao.py" for %%I in ("%~dp0..\..") do set "FLOW_BASE=%%~fI\"
cd /d "%FLOW_BASE%"

if exist "Automacao.exe" (
    start "" "%FLOW_BASE%Automacao.exe"
    endlocal
    exit /b 0
)

if exist "tauri_ui\src-tauri\target\release\automacao_tauri_ui.exe" (
    start "" "%FLOW_BASE%tauri_ui\src-tauri\target\release\automacao_tauri_ui.exe"
    endlocal
    exit /b 0
)

if exist "tauri_ui\src-tauri\target\release\Automacao.exe" (
    start "" "%FLOW_BASE%tauri_ui\src-tauri\target\release\Automacao.exe"
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
