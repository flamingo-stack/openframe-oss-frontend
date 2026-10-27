!macro NSIS_HOOK_PREINSTALL
  ReadRegStr $R0 SHCTX "Software\openframe\${PRODUCTNAME}" ""
  ${If} $R0 != ""
  ${AndIf} $R0 != $INSTDIR
  ${AndIf} $INSTDIR == "$LOCALAPPDATA\${PRODUCTNAME}"
    StrCpy $INSTDIR $R0
    SetOutPath $INSTDIR
    RMDir "$LOCALAPPDATA\${PRODUCTNAME}"
  ${EndIf}
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "${UNINSTKEY}" "QuietUninstallString" '"$INSTDIR\uninstall.exe" /S'
  DeleteRegKey SHCTX "Software\openframe\${PRODUCTNAME}"
  DeleteRegKey /ifempty SHCTX "Software\openframe"
!macroend
