# Load .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$appPort = if ($env:APP_PORT) { $env:APP_PORT } else { "80" }

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Building & starting QitekComputer..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

docker compose up --build -d

# Get local IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" -and $_.PrefixOrigin -eq "Dhcp" } | Select-Object -First 1).IPAddress
if (-not $localIP) {
    $localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  QitekComputer is running!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Local:     " -NoNewline; Write-Host "http://localhost:$appPort" -ForegroundColor Yellow
Write-Host "  LAN:       " -NoNewline; Write-Host "http://${localIP}:$appPort" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Waiting for tunnel URL..." -ForegroundColor Gray

# Wait for cloudflared to print the tunnel URL
$tunnelUrl = $null
for ($i = 0; $i -lt 30; $i++) {
    $logs = docker compose logs tunnel 2>&1 | Out-String
    if ($logs -match '(https://[a-z0-9-]+\.trycloudflare\.com)') {
        $tunnelUrl = $Matches[1]
        break
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
if ($tunnelUrl) {
    Write-Host "  Public:    " -NoNewline; Write-Host $tunnelUrl -ForegroundColor Cyan
} else {
    Write-Host "  Run 'docker compose logs tunnel' to find the public URL" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
