@echo off
setlocal
cd /d "%~dp0"
python instalador_flowdetect.py
if errorlevel 1 (
  py -3 instalador_flowdetect.py
)
if errorlevel 1 (
  echo.
  echo Nao foi possivel abrir o instalador do FlowDetect.
  echo Verifique se o Python esta instalado e disponivel no PATH.
  pause
)
