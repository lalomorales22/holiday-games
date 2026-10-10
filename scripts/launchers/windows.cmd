@echo off
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 22.12 or newer from https://nodejs.org, then open this launcher again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22||(Number(process.versions.node.split('.')[0])===22&&Number(process.versions.node.split('.')[1])<12)){console.error('Please install Node.js 22.12 or newer.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Opening Holiday Arcade. Keep this window open while the family plays.
start "Holiday Arcade browser" /b node -e "const http=require('http'),cp=require('child_process');let attempts=0;const port=process.env.PORT||3000;const timer=setInterval(()=>{http.get('http://localhost:'+port+'/api/health',res=>{if(res.statusCode===200){clearInterval(timer);cp.exec('start http://localhost:'+port);process.exit(0)}}).on('error',()=>{});if(++attempts>30){clearInterval(timer);process.exit(1)}},500)"
node server/index.js
pause
