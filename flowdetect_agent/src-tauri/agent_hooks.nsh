; Agent-specific hooks. No broad cleanup of user or Studio data here;
; Tauri manages its own installed application resources.
!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Validando runtime e OCR do FlowDetect Agent..."
  IfFileExists "$INSTDIR\python_runtime\python.exe" 0 agent_runtime_error
  ExecWait '"$INSTDIR\python_runtime\python.exe" -c "import openpyxl, pyautogui, cv2, PIL, pytesseract, reportlab, uiautomation"' $0
  StrCmp $0 "0" 0 agent_runtime_error
  IfFileExists "$INSTDIR\Tesseract-OCR\tesseract.exe" 0 agent_runtime_error
  ExecWait '"$INSTDIR\Tesseract-OCR\tesseract.exe" --version' $0
  StrCmp $0 "0" agent_runtime_ok agent_runtime_error
  agent_runtime_error:
    MessageBox MB_ICONSTOP|MB_OK "O runtime do Agent nao foi validado. Repare a instalacao antes de executar automacoes."
    Abort
  agent_runtime_ok:
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /IM "${MAINBINARYNAME}.exe" /T'
  Pop $0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Do not erase shared FlowDetect directories, credentials or virtual machines.
!macroend
