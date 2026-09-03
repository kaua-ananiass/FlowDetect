!macro NSIS_HOOK_POSTINSTALL
  !if "${PRODUCTNAME}" == "FlowDetect Agent"
    DetailPrint "Validando Python portatil do FlowDetect Agent..."
    IfFileExists "$INSTDIR\python_runtime\python.exe" 0 flowdetect_agent_runtime_missing
      ExecWait '"$INSTDIR\python_runtime\python.exe" -c "import openpyxl, pyautogui, cv2, PIL, pytesseract, reportlab, uiautomation"' $0
      StrCmp $0 "0" flowdetect_prepare_hyperv
      MessageBox MB_ICONSTOP|MB_OK "O Python portatil foi copiado, mas as bibliotecas do FlowDetect Agent nao foram validadas.$\r$\n$\r$\nRecompile o Agent recriando python_runtime_prebuilt."
      Abort

    flowdetect_agent_runtime_missing:
      MessageBox MB_ICONSTOP|MB_OK "O Python portatil do FlowDetect Agent nao foi encontrado no pacote.$\r$\n$\r$\nRecompile o Agent incluindo python_runtime_prebuilt como python_runtime."
      Abort

    Goto flowdetect_prepare_hyperv
  !endif

  IfFileExists "$INSTDIR\resources\instalar_dependencias_silencioso.bat" 0 flowdetect_try_root_dependency_script
    DetailPrint "Preparando dependencias basicas do FlowDetect..."
    ExecWait '"$SYSDIR\cmd.exe" /C ""$INSTDIR\resources\instalar_dependencias_silencioso.bat""' $0
    StrCmp $0 "0" flowdetect_prepare_hyperv
    DetailPrint "Aviso: a preparacao automatica falhou. O FlowDetect tentara reparar as dependencias ao iniciar."
    MessageBox MB_ICONEXCLAMATION|MB_OK "A instalacao vai continuar, mas a preparacao automatica do FlowDetect precisa ser revisada.$\r$\n$\r$\nLogs:$\r$\n$INSTDIR\resources\instalacao_dependencias.log$\r$\n$INSTDIR\resources\python_installer.log$\r$\n$\r$\nO Agent tentara reparar as dependencias novamente ao receber/importar automacoes."
    Goto flowdetect_prepare_hyperv

  flowdetect_try_root_dependency_script:
  IfFileExists "$INSTDIR\instalar_dependencias_silencioso.bat" 0 flowdetect_prepare_hyperv
    DetailPrint "Preparando dependencias basicas do FlowDetect..."
    ExecWait '"$SYSDIR\cmd.exe" /C ""$INSTDIR\instalar_dependencias_silencioso.bat""' $0
    StrCmp $0 "0" flowdetect_prepare_hyperv
    DetailPrint "Aviso: a preparacao automatica falhou. O FlowDetect tentara reparar as dependencias ao iniciar."
    MessageBox MB_ICONEXCLAMATION|MB_OK "A instalacao vai continuar, mas a preparacao automatica do FlowDetect precisa ser revisada.$\r$\n$\r$\nLogs:$\r$\n$INSTDIR\instalacao_dependencias.log$\r$\n$INSTDIR\python_installer.log$\r$\n$\r$\nO Agent tentara reparar as dependencias novamente ao receber/importar automacoes."
    Goto flowdetect_prepare_hyperv

  flowdetect_prepare_hyperv:
  IfFileExists "$INSTDIR\resources\hyperv_setup\Preparar-FlowDetectHyperV.ps1" 0 flowdetect_postinstall_done
    DetailPrint "Abrindo o assistente de preparacao do Hyper-V..."
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\hyperv_setup\Preparar-FlowDetectHyperV.ps1" -ManifestPath "$INSTDIR\resources\hyperv_setup\golden-vm.json"'
    Pop $1
    StrCmp $1 "0" flowdetect_postinstall_done
    MessageBox MB_ICONINFORMATION|MB_OK "A instalacao do FlowDetect Studio foi concluida.$\r$\n$\r$\nA preparacao do Hyper-V precisa ser retomada depois do reinicio ou foi adiada.$\r$\n$\r$\nExecute novamente:$\r$\n$INSTDIR\resources\hyperv_setup\Preparar-FlowDetectHyperV.ps1"
  flowdetect_postinstall_done:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "Encerrando processos do FlowDetect antes da remocao..."
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${MAINBINARYNAME}.exe" /T'
  Pop $0
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "FlowDetect.exe" /T'
  Pop $1
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "FlowDetectAgent.exe" /T'
  Pop $2
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "python.exe" /FI "WINDOWTITLE eq FlowDetect*" /T'
  Pop $3
!macroend

!macro FLOWDETECT_REMOVE_DIR PATH_TO_REMOVE
  IfFileExists "${PATH_TO_REMOVE}\*.*" 0 +3
    DetailPrint "Removendo: ${PATH_TO_REMOVE}"
    RMDir /r "${PATH_TO_REMOVE}"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Executando limpeza completa do FlowDetect..."

  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "FlowDetectAgent"
  DeleteRegValue HKLM "Software\Microsoft\Windows\CurrentVersion\Run" "FlowDetectAgent"
  DeleteRegKey HKCU "Software\kaua\${PRODUCTNAME}"
  DeleteRegKey HKCU "Software\${PRODUCTNAME}"
  DeleteRegKey HKCU "Software\FlowDetect"
  DeleteRegKey HKCU "Software\Classes\${BUNDLEID}"
  DeleteRegKey HKLM "Software\kaua\${PRODUCTNAME}"
  DeleteRegKey HKLM "Software\${PRODUCTNAME}"
  DeleteRegKey HKLM "Software\FlowDetect"

  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /C "cmdkey /delete:FlowDetect/HyperV/%COMPUTERNAME%"'
  Pop $0

  !insertmacro FLOWDETECT_REMOVE_DIR "$INSTDIR"
  !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\Programs\${PRODUCTNAME}"
  !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\${PRODUCTNAME}"
  !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\${PRODUCTNAME}"
  !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\${BUNDLEID}"
  !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\${BUNDLEID}"
  !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\kaua\${PRODUCTNAME}"
  !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\kaua\${PRODUCTNAME}"

  !if "${PRODUCTNAME}" == "FlowDetect Agent"
    !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\FlowDetect\Agent"
    !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\FlowDetect\Agent"
    !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\FlowDetect Agent"
    !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\FlowDetect Agent"
    !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\ms-playwright"
  !endif

  !if "${PRODUCTNAME}" == "FlowDetect Studio"
    !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\FlowDetect Studio"
    !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\FlowDetect Studio"
    !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\FlowDetect\Studio"
    !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\FlowDetect\Studio"
  !endif

  ; Limpeza total compartilhada. Inclui runtime, caches, sessoes Hyper-V e VMs criadas pelo FlowDetect.
  !insertmacro FLOWDETECT_REMOVE_DIR "$LOCALAPPDATA\FlowDetect"
  !insertmacro FLOWDETECT_REMOVE_DIR "$APPDATA\FlowDetect"
  !insertmacro FLOWDETECT_REMOVE_DIR "$COMMONAPPDATA\FlowDetect"

  DetailPrint "Limpeza completa do FlowDetect concluida."
!macroend
