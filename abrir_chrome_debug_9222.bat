@echo off
setlocal

set "BASE_DIR=%~dp0"
set "DEBUG_PROFILE=%BASE_DIR%.chrome_debug_profile"

set "CHROME_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME_EXE if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if not defined CHROME_EXE (
  echo Chrome nao encontrado nas pastas padrao.
  echo Abra manualmente com:
  echo chrome --remote-debugging-port=9222 --user-data-dir="%DEBUG_PROFILE%"
  exit /b 1
)

if not exist "%DEBUG_PROFILE%" mkdir "%DEBUG_PROFILE%"

start "" "%CHROME_EXE%" --remote-debugging-port=9222 --user-data-dir="%DEBUG_PROFILE%"
echo Chrome iniciado em modo debug na porta 9222.
echo Agora os blocos "Chrome / Elemento HTML" podem tentar se conectar a esta sessao.

endlocal
