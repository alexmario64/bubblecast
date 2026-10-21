@echo off
cd /d "%~dp0"
set "BUBBLECAST_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BUBBLECAST_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%BUBBLECAST_NODE%" desktop/install.mjs
pause
