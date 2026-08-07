@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_CMD=python"
if "%PYTHON_CMD%"=="python" (
    where py >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON_CMD=py -3"
    )
)

if not exist "executar_automacao.py" (
    echo Arquivo executar_automacao.py nao encontrado.
    pause
    endlocal
    exit /b 1
)

call %PYTHON_CMD% executar_automacao.py --modo normal
endlocal
