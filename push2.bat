@echo off
setlocal EnableExtensions

echo ==================================================
echo [START] push2.bat
echo [INFO] Working dir: %cd%
echo ==================================================

REM --- Pull latest ---
echo [INFO] Pulling latest from origin/master ...
git pull origin master
if errorlevel 1 (
  echo [ERROR] git pull failed.
  pause
  exit /b 1
)

REM --- Generate covers.json (your existing step) ---
echo [INFO] Generating cover\covers.json ...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\generate-covers.ps1"
if errorlevel 1 (
  echo [ERROR] Failed to generate covers.json
  pause
  exit /b 1
)

REM --- Build site snapshot + dist output ---
echo [INFO] Running npm run site (generate dist\comics.snapshot.json + dist\index.html) ...

REM check Node & npm
node -v >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found in PATH.
  pause
  exit /b 1
)

npm -v >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found in PATH.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json not found. Please run this bat in the project root.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [INFO] node_modules not found. Running npm install ...
  npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

npm run site
if errorlevel 1 (
  echo [ERROR] npm run site failed.
  pause
  exit /b 1
)

if not exist "dist\comics.snapshot.json" (
  echo [ERROR] dist\comics.snapshot.json not found after npm run site.
  pause
  exit /b 1
)

REM --- Stage all changes ---
echo [INFO] git add -A
git add -A
if errorlevel 1 (
  echo [ERROR] git add failed.
  pause
  exit /b 1
)

REM --- If nothing changed, still push (optional) ---
git diff --cached --quiet
if not errorlevel 1 (
  echo [INFO] Nothing to commit. (Working tree clean)
  goto PUSH
)

REM --- Commit message (optional arg) ---
set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update site"

echo [INFO] git commit -m "%MSG%"
git commit -m "%MSG%"
if errorlevel 1 (
  echo [ERROR] git commit failed.
  pause
  exit /b 1
)

:PUSH
echo [INFO] git push origin master
git push origin master
if errorlevel 1 (
  echo [ERROR] git push failed.
  pause
  exit /b 1
)

echo ==================================================
echo [OK] Done! Site build + commit + push completed.
echo ==================================================
pause
endlocal
