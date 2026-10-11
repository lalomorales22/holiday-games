@echo off
setlocal DisableDelayedExpansion
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\installers\install.ps1" %*
if errorlevel 1 (
  echo The installer did not finish. Review the message above, then try again.
  pause
  exit /b 1
)
