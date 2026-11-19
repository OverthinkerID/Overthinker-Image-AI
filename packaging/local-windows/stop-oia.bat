@echo off
setlocal
set "PID_FILE=%~dp0..\..\logs\oia.pids"
if not exist "%PID_FILE%" set "PID_FILE=%~dp0logs\oia.pids"
if exist "%PID_FILE%" (
  for /f "usebackq delims=" %%P in ("%PID_FILE%") do (
    taskkill /PID %%P /T /F >nul 2>&1
  )
  del "%PID_FILE%" >nul 2>&1
  echo [OK] OIA - Overthinker Image AI stopped.
) else (
  echo [INFO] No active OIA PID file found.
)
pause
