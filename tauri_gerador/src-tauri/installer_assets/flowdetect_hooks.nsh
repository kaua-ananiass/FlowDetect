!macro NSIS_HOOK_POSTINSTALL
  IfFileExists "$INSTDIR\resources\instalar_dependencias_silencioso.bat" 0 flowdetect_prepare_hyperv
    DetailPrint "Preparando dependencias basicas do FlowDetect..."
    nsExec::ExecToLog '"$SYSDIR\cmd.exe" /C ""$INSTDIR\resources\instalar_dependencias_silencioso.bat""'
    Pop $0
    StrCmp $0 "0" flowdetect_prepare_hyperv
    MessageBox MB_ICONSTOP|MB_OK "A preparacao automatica do FlowDetect falhou.$\r$\n$\r$\nAbra o arquivo:$\r$\n$INSTDIR\resources\instalacao_dependencias.log$\r$\n$\r$\nCorrija a instalacao e rode novamente o setup."
    Abort

  flowdetect_prepare_hyperv:
  IfFileExists "$INSTDIR\resources\hyperv_setup\Preparar-FlowDetectHyperV.ps1" 0 flowdetect_postinstall_done
    DetailPrint "Abrindo o assistente de preparacao do Hyper-V..."
    nsExec::ExecToLog '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\resources\hyperv_setup\Preparar-FlowDetectHyperV.ps1" -ManifestPath "$INSTDIR\resources\hyperv_setup\golden-vm.json"'
    Pop $1
    StrCmp $1 "0" flowdetect_postinstall_done
    MessageBox MB_ICONINFORMATION|MB_OK "A instalacao do FlowDetect Studio foi concluida.$\r$\n$\r$\nA preparacao do Hyper-V precisa ser retomada depois do reinicio ou foi adiada.$\r$\n$\r$\nExecute novamente:$\r$\n$INSTDIR\resources\hyperv_setup\Preparar-FlowDetectHyperV.ps1"
  flowdetect_postinstall_done:
!macroend
