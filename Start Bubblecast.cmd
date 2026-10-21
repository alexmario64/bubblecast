@echo off
cd /d "%~dp0"
set "BUBBLECAST_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BUBBLECAST_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%BUBBLECAST_NODE%"=="node" if not exist "%BUBBLECAST_NODE%" (
 echo Node.js 22 or newer is required. Install it from https://nodejs.org
 pause
 exit /b 1
)
start "" "http://127.0.0.1:3927"
"%BUBBLECAST_NODE%" server.mjs
pause
