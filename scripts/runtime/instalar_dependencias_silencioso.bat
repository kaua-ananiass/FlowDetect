@echo off
setlocal
set "FLOW_ROOT=%~dp0"
if exist "%~dp0..\..\executar_automacao.py" for %%I in ("%~dp0..\..") do set "FLOW_ROOT=%%~fI\"
cd /d "%FLOW_ROOT%"
if "%FLOW_ROOT:~-1%"=="\" set "FLOW_ROOT=%FLOW_ROOT:~0,-1%"
for %%I in ("%FLOW_ROOT%") do set "FLOW_ROOT_NAME=%%~nxI"
if /I "%FLOW_ROOT_NAME%"=="resources" for %%I in ("%FLOW_ROOT%\..") do set "FLOW_ROOT=%%~fI"
set "FLOW_ASSET_ROOT=%FLOW_ROOT%"
if not exist "%FLOW_ASSET_ROOT%\python-installer.exe" if exist "%FLOW_ROOT%\resources\python-installer.exe" set "FLOW_ASSET_ROOT=%FLOW_ROOT%\resources"
set "FLOW_PY_DIR=%FLOW_ROOT%\python_runtime"
set "FLOW_PY_EXE=%FLOW_PY_DIR%\python.exe"
set "FLOW_PY_ARGS="
set "FLOW_PY_INSTALLER=%FLOW_ASSET_ROOT%\python-installer.exe"
set "FLOW_WHEELS=%FLOW_ASSET_ROOT%\python-wheels"
set "FLOW_REQUIREMENTS=%FLOW_ASSET_ROOT%\requirements.txt"
set "FLOW_VALIDATE_SCRIPT=%FLOW_ASSET_ROOT%\validar_dependencias_instaladas.py"
set "FLOW_VALIDATE_JSON=%FLOW_ROOT%\validacao_dependencias.json"
set "FLOW_DIAG_JSON=%FLOW_ROOT%\diagnostico_instalacao.json"
set "FLOW_INSTALL_LOG=%FLOW_ROOT%\instalacao_dependencias.log"
set "FLOW_PY_INSTALL_LOG=%FLOW_ROOT%\python_installer.log"
set "PYTHONUTF8=1"

type nul > "%FLOW_INSTALL_LOG%"
call :log Iniciando preparacao silenciosa do FlowDetect.
call :log Pasta do script: "%FLOW_ROOT%".
call :log Pasta de assets: "%FLOW_ASSET_ROOT%".

call :ensure_local_python
if errorlevel 1 exit /b 1

call :bootstrap_packaging_tools
if errorlevel 1 exit /b 1

call :install_requirements
if errorlevel 1 exit /b 1

call :validate_runtime
if errorlevel 1 exit /b 1

if exist "%FLOW_ASSET_ROOT%\diagnostico_ambiente.py" (
  call :log Gerando diagnostico final do ambiente.
  "%FLOW_PY_EXE%" %FLOW_PY_ARGS% "%FLOW_ASSET_ROOT%\diagnostico_ambiente.py" > "%FLOW_DIAG_JSON%" 2>> "%FLOW_INSTALL_LOG%"
)

call :log Preparacao do FlowDetect concluida com sucesso.
exit /b 0

:log
echo [FlowDetect] %*
>> "%FLOW_INSTALL_LOG%" echo [%date% %time%] %*
exit /b 0

:ensure_local_python
if exist "%FLOW_PY_EXE%" (
  call :log Verificando Python local existente.
  "%FLOW_PY_EXE%" --version >nul 2>&1
  if not errorlevel 1 exit /b 0
  call :log Python local existente esta invalido. Recriando runtime em "%FLOW_PY_DIR%".
  rmdir /s /q "%FLOW_PY_DIR%" >> "%FLOW_INSTALL_LOG%" 2>&1
)

if exist "%FLOW_PY_INSTALLER%" (
  call :log Instalando Python local em "%FLOW_PY_DIR%".
  if exist "%FLOW_PY_INSTALL_LOG%" del /f /q "%FLOW_PY_INSTALL_LOG%" >nul 2>&1
  "%FLOW_PY_INSTALLER%" /quiet /log "%FLOW_PY_INSTALL_LOG%" InstallAllUsers=0 TargetDir="%FLOW_PY_DIR%" AssociateFiles=0 PrependPath=0 AppendPath=0 Shortcuts=0 Include_doc=0 Include_test=0 Include_tools=0 Include_launcher=0 InstallLauncherAllUsers=0 Include_pip=1 Include_tcltk=1 >> "%FLOW_INSTALL_LOG%" 2>&1
  set "FLOW_PY_INSTALL_EXIT=%ERRORLEVEL%"
  call :log Instalador Python finalizou com codigo %FLOW_PY_INSTALL_EXIT%.
  call :wait_for_local_python
  if not errorlevel 1 exit /b 0
)

if not exist "%FLOW_PY_INSTALLER%" (
  call :log Instalador Python esperado em "%FLOW_PY_INSTALLER%" nao foi localizado.
) else (
  call :log Instalador Python nao concluiu a instalacao local. Log detalhado: "%FLOW_PY_INSTALL_LOG%".
)

call :log Tentando reutilizar um Python ja instalado no sistema.
call :mirror_system_python python
if not errorlevel 1 exit /b 0
call :mirror_system_python py -3
if not errorlevel 1 exit /b 0

call :log ERRO: nenhum Python compativel foi encontrado ou instalado.
exit /b 1

:mirror_system_python
%* --version >nul 2>&1
if errorlevel 1 exit /b 1

for /f "delims=" %%P in ('where %1 2^>nul') do (
  set "FLOW_PY_EXE=%%P"
  set "FLOW_PY_ARGS="
  if /i "%1"=="py" set "FLOW_PY_ARGS=-3"
  call :log Python do sistema localizado em "%%P".
  goto mirror_done
)
exit /b 1

:mirror_done
exit /b 0

:wait_for_local_python
set /a FLOW_WAIT_COUNT=0
:wait_for_local_python_loop
if exist "%FLOW_PY_EXE%" (
  "%FLOW_PY_EXE%" --version >> "%FLOW_INSTALL_LOG%" 2>&1
  if not errorlevel 1 (
    call :log Python local instalado com sucesso.
    exit /b 0
  )
)
set /a FLOW_WAIT_COUNT+=1
if %FLOW_WAIT_COUNT% GEQ 60 (
  call :log Python local nao ficou pronto apos 60 segundos.
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto wait_for_local_python_loop

:bootstrap_packaging_tools
call :log Preparando pip, setuptools e wheel.
"%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m ensurepip --upgrade >> "%FLOW_INSTALL_LOG%" 2>&1

if exist "%FLOW_WHEELS%" (
  "%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m pip install --upgrade --no-index --find-links "%FLOW_WHEELS%" pip setuptools wheel --prefer-binary --disable-pip-version-check >> "%FLOW_INSTALL_LOG%" 2>&1
  if not errorlevel 1 (
    call :log Ferramentas de empacotamento preparadas com o cache offline.
    exit /b 0
  )
)

"%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m pip install --upgrade pip setuptools wheel --prefer-binary --disable-pip-version-check >> "%FLOW_INSTALL_LOG%" 2>&1
if not errorlevel 1 (
  call :log Ferramentas de empacotamento atualizadas usando o indice padrao.
  exit /b 0
)

"%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m pip install --user --upgrade pip setuptools wheel --prefer-binary --disable-pip-version-check >> "%FLOW_INSTALL_LOG%" 2>&1
if not errorlevel 1 (
  call :log Ferramentas de empacotamento atualizadas no modo usuario.
  exit /b 0
)

call :log Aviso: nao foi possivel atualizar pip/setuptools/wheel. O instalador vai tentar continuar mesmo assim.
exit /b 0

:install_requirements
if not exist "%FLOW_REQUIREMENTS%" exit /b 0

call :log Instalando dependencias Python do FlowDetect.

if exist "%FLOW_WHEELS%" (
  "%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m pip install --no-index --find-links "%FLOW_WHEELS%" -r "%FLOW_REQUIREMENTS%" --prefer-binary --no-build-isolation --disable-pip-version-check >> "%FLOW_INSTALL_LOG%" 2>&1
  if not errorlevel 1 (
    call :log Dependencias instaladas com sucesso usando o cache offline.
    exit /b 0
  )
)

"%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m pip install -r "%FLOW_REQUIREMENTS%" --prefer-binary --no-build-isolation --disable-pip-version-check >> "%FLOW_INSTALL_LOG%" 2>&1
if not errorlevel 1 (
  call :log Dependencias instaladas com sucesso usando o indice padrao.
  exit /b 0
)

"%FLOW_PY_EXE%" %FLOW_PY_ARGS% -m pip install --user -r "%FLOW_REQUIREMENTS%" --prefer-binary --no-build-isolation --disable-pip-version-check >> "%FLOW_INSTALL_LOG%" 2>&1
if not errorlevel 1 (
  call :log Dependencias instaladas com sucesso no modo usuario.
  exit /b 0
)

call :log ERRO: nao foi possivel instalar as dependencias Python do FlowDetect.
exit /b 1

:validate_runtime
if not exist "%FLOW_VALIDATE_SCRIPT%" (
  call :log Aviso: script de validacao nao foi encontrado.
  exit /b 0
)

call :log Validando captura, reconhecimento e bibliotecas principais.
"%FLOW_PY_EXE%" %FLOW_PY_ARGS% "%FLOW_VALIDATE_SCRIPT%" > "%FLOW_VALIDATE_JSON%" 2>> "%FLOW_INSTALL_LOG%"
if errorlevel 1 (
  call :log ERRO: a validacao final detectou dependencias criticas ausentes.
  if exist "%FLOW_VALIDATE_JSON%" type "%FLOW_VALIDATE_JSON%" >> "%FLOW_INSTALL_LOG%"
  exit /b 1
)

if exist "%FLOW_VALIDATE_JSON%" type "%FLOW_VALIDATE_JSON%" >> "%FLOW_INSTALL_LOG%"
call :log Runtime validado com sucesso.
exit /b 0
