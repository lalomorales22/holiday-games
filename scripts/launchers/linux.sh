#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1; then
  printf 'Install Node.js 22.12 or newer from https://nodejs.org, then open this launcher again.\n'
  exit 1
fi
node -e 'if(Number(process.versions.node.split(".")[0])<22||(Number(process.versions.node.split(".")[0])===22&&Number(process.versions.node.split(".")[1])<12)){console.error("Please install Node.js 22.12 or newer.");process.exit(1)}'
if [ ! -d node_modules ]; then
  npm ci --omit=dev --no-audit --no-fund
fi
printf 'Opening Holiday Arcade. Keep this window open while the family plays.\n'
if command -v xdg-open >/dev/null 2>&1; then
  (node -e 'const http=require("http");let attempts=0;const timer=setInterval(()=>{http.get("http://localhost:"+(process.env.PORT||3000)+"/api/health",res=>{if(res.statusCode===200){clearInterval(timer);process.exit(0)}}).on("error",()=>{});if(++attempts>30){clearInterval(timer);process.exit(1)}},500)' && xdg-open "http://localhost:${PORT:-3000}") >/dev/null 2>&1 &
fi
exec node server/index.js
