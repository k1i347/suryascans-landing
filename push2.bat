@echo off
setlocal EnableExtensions

echo [INFO] Pulling latest from origin/master ...
git pull origin master
if errorlevel 1 (
  echo [ERROR] git pull failed.
  pause
  exit /b 1
)

echo [INFO] Generating cover\covers.json ...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\generate-covers.ps1"
if errorlevel 1 (
  echo [ERROR] Failed to generate covers.json
  pause
  exit /b 1
)

echo [INFO] git add -A
git add -A
if errorlevel 1 (
  echo [ERROR] git add failed.
  pause
  exit /b 1
)

git diff --cached --quiet
if not errorlevel 1 (
  echo [INFO] Nothing to commit.
  goto PUSH
)

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update site"

echo [INFO] git commit -m "%MSG%"
git commit -m "%MSG%"

:PUSH
echo [INFO] git push origin master
git push origin master

echo [OK] Done!
pause
endlocal
