$ErrorActionPreference = "Stop"

# Ensure pnpm is available
if (-Not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Please install pnpm first: npm install -g pnpm"
    exit 1
}

# Run DB script
Write-Host "Starting Database..."
& "$PSScriptRoot\start-db.ps1"

# Set environment variables
$env:DATABASE_URL = "postgresql://postgres@localhost:5432/fixora"
$env:PORT = "5000"

Write-Host "Pushing schema to DB..."
cd "$PSScriptRoot\lib\db"
pnpm run push-force

Write-Host "Starting API and Frontend..."
cd "$PSScriptRoot"

# Start the API server in new window
Start-Process -FilePath "pnpm" -ArgumentList "--filter", "@workspace/api-server", "run", "dev" 

# Start frontend in new window
Start-Process -FilePath "pnpm" -ArgumentList "--filter", "@workspace/fixora", "run", "dev" 

Write-Host "App is starting! Check http://localhost:5173"
