@echo off
title OIA - Overthinker Image AI (Local Edition)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-oia.ps1"
if errorlevel 1 pause
