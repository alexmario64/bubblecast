; Adds an "Uninstall Bubblecast" Start menu shortcut next to the app's own. Uninstalling also stops
; Bubblecast from starting with Windows. Settings and sign-ins in %APPDATA%\Bubblecast are kept.
!macro customInstall
  CreateShortCut "$SMPROGRAMS\Uninstall Bubblecast.lnk" "$INSTDIR\Uninstall Bubblecast.exe"
!macroend
!macro customUnInstall
  Delete "$SMPROGRAMS\Uninstall Bubblecast.lnk"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Bubblecast"
!macroend
