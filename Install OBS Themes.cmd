@echo off
setlocal
pushd "%~dp0"
powershell.exe -NoProfile -Command "$ErrorActionPreference='Stop'; $themeSource=Join-Path (Get-Location) 'obs-themes'; $themeTarget=Join-Path $env:APPDATA 'obs-studio\themes'; New-Item -ItemType Directory -Path $themeTarget -Force | Out-Null; Get-ChildItem -LiteralPath $themeSource -Filter 'Bubblecast_*.ovt' -File | Copy-Item -Destination $themeTarget -Force; Copy-Item -LiteralPath (Join-Path $themeSource 'BubblecastConsole') -Destination $themeTarget -Recurse -Force; Write-Host 'Installed the Bubblecast styles and console icons. Restart OBS, then open Settings > Appearance. Select Theme: Yami, then choose a Bubblecast style.'"
if errorlevel 1 (
 echo Theme installation failed.
 popd
 exit /b 1
)
popd
echo Existing OBS themes and the selected style were kept.
pause
