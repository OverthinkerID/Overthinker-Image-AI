$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (Test-Path (Join-Path $RootDir "..\..\apps\api\package.json")) {
  $RepoRoot = Resolve-Path (Join-Path $RootDir "..\..")
} else {
  $RepoRoot = $RootDir
}

Write-Host "=== OIA - Overthinker Image AI (Local Edition) ===" -ForegroundColor Green

# 1. Prerequisite Check: Node.js >= 18.17.0
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Host "[ERROR] Node.js >= 18.17.0 is required. Install from https://nodejs.org/" -ForegroundColor Red
  exit 1
}
$nodeVer = (& node -v).TrimStart('v')
Write-Host "[OK] Node.js v$nodeVer detected."

$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegCmd) {
  Write-Host "[OK] FFmpeg detected for video rendering."
} else {
  Write-Host "[WARN] FFmpeg not found in PATH. Video studio will export editable motion bundles." -ForegroundColor Yellow
}

# 2. Environment Initialization
$ApiEnv = Join-Path $RepoRoot "apps\api\.env"
$EnvExample = Join-Path $RepoRoot ".env.example"
if (-not (Test-Path $ApiEnv) -and (Test-Path $EnvExample)) {
  Copy-Item $EnvExample $ApiEnv
  Write-Host "[OK] Initialized apps\api\.env from .env.example (APP_EDITION=LOCAL)."
}

# 3. Ensure Logs & Storage Directories
$LogsDir = Join-Path $RepoRoot "logs"
$StorageDir = Join-Path $RepoRoot "storage"
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
New-Item -ItemType Directory -Force -Path $StorageDir | Out-Null

# 4. Install dependencies if node_modules missing
if (-not (Test-Path (Join-Path $RepoRoot "node_modules"))) {
  Write-Host "[INFO] Installing dependencies..."
  Push-Location $RepoRoot
  npm ci --omit=dev
  Pop-Location
}

# 5. Prisma Generate & SQLite Migrations
Push-Location (Join-Path $RepoRoot "apps\api")
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = "file:./dev.db" }
npx prisma generate | Out-Null
npx prisma migrate deploy
Pop-Location

# 6. Start API & Web Servers (localhost binding)
$ApiLog = Join-Path $LogsDir "oia-api.log"
$WebLog = Join-Path $LogsDir "oia-web.log"

Write-Host "[INFO] Starting OIA API (http://localhost:4000) and Web UI (http://localhost:3000)..."
$apiProc = Start-Process -FilePath "npm" -ArgumentList "run","start","--workspace=apps/api" -WorkingDirectory $RepoRoot -RedirectStandardOutput $ApiLog -RedirectStandardError (Join-Path $LogsDir "oia-api-err.log") -PassThru -WindowStyle Hidden
$webProc = Start-Process -FilePath "npm" -ArgumentList "run","start","--workspace=apps/web" -WorkingDirectory $RepoRoot -RedirectStandardOutput $WebLog -RedirectStandardError (Join-Path $LogsDir "oia-web-err.log") -PassThru -WindowStyle Hidden

"$($apiProc.Id)`n$($webProc.Id)" | Set-Content (Join-Path $LogsDir "oia.pids")

Start-Sleep -Seconds 3
Start-Process "http://localhost:3000"
Write-Host "[READY] OIA is running at http://localhost:3000. Run stop-oia.bat to stop gracefully." -ForegroundColor Cyan
