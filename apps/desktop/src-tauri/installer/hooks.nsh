!define MUI_CUSTOMFUNCTION_GUIINIT MigratePublisherKey

Function MigratePublisherKey
  ReadRegStr $0 SHCTX "Software\Flamingo AI, Inc.\OpenFrame Console" ""
  ReadRegStr $1 SHCTX "Software\openframe\OpenFrame Console" ""
  ${If} $0 == ""
  ${AndIf} $1 != ""
    WriteRegStr SHCTX "Software\Flamingo AI, Inc.\OpenFrame Console" "" $1
    ${If} $INSTDIR == "$LOCALAPPDATA\OpenFrame Console"
      StrCpy $INSTDIR $1
    ${EndIf}
  ${EndIf}
FunctionEnd

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
