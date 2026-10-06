$ErrorActionPreference = "Stop"
$pgDir = "$PSScriptRoot\pgsql"

if (-Not (Test-Path "$PSScriptRoot\pg.zip")) {
    Write-Host "PostgreSQL zip not found. Please ensure pg.zip is downloaded."
}

if (-Not (Test-Path $pgDir)) {
    Write-Host "Extracting PostgreSQL... This may take a minute."
    Expand-Archive -Path "$PSScriptRoot\pg.zip" -DestinationPath "$PSScriptRoot"
}

$dataDir = "$pgDir\data"
if (-Not (Test-Path $dataDir)) {
    Write-Host "Initializing PostgreSQL database..."
    & "$pgDir\bin\initdb.exe" -U postgres -A trust -D $dataDir
}

Write-Host "Starting PostgreSQL..."
& "$pgDir\bin\pg_ctl.exe" -D $dataDir -l logfile start

Write-Host "Waiting for database to start..."
Start-Sleep -Seconds 3

Write-Host "Creating database..."
& "$pgDir\bin\createdb.exe" -U postgres fixora 2>$null

Write-Host "PostgreSQL is running!"
