@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0compilar_gerador_exe.ps1"
echo.
echo Processo finalizado.
pause
