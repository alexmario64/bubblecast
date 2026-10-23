; Uninstalling stops Bubblecast from starting with Windows. Settings and sign-ins in %APPDATA%\Bubblecast are kept.
!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Bubblecast"
!macroend
