# Load .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$frontendPort = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "3000" }
$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8000" }

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Building & starting QitekShop..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

docker compose -f docker-compose.prod.yml up --build -d

# Get local IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress
if (-not $localIP) {
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  QitekShop is running!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend:  " -NoNewline; Write-Host "http://${localIP}:${frontendPort}" -ForegroundColor Yellow
Write-Host "  Backend:   " -NoNewline; Write-Host "http://${localIP}:${backendPort}" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Other devices on the same network" -ForegroundColor Gray
Write-Host "  can access the URLs above." -ForegroundColor Gray
Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
