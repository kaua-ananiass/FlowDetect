!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$INSTDIR\resources\instalar_dependencias_silencioso.bat" 0 flowdetect_postinstall_done
    DetailPrint "Preparando dependencias basicas do FlowDetect..."
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /C ""$INSTDIR\resources\instalar_dependencias_silencioso.bat""'
    Pop $0
    StrCmp $0 "0" flowdetect_postinstall_done
    MessageBox MB_ICONSTOP|MB_OK "A preparacao automatica do FlowDetect falhou.$\r$\n$\r$\nAbra o arquivo:$\r$\n$INSTDIR\resources\instalacao_dependencias.log$\r$\n$\r$\nCorrija a instalacao e rode novamente o setup."
    Abort
  flowdetect_postinstall_done:
!macroend
