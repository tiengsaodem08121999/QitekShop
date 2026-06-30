# Load .env
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
        }
    }
}

$appPort = if ($env:APP_PORT) { $env:APP_PORT } else { "80" }

function Test-PortInUse {
    param([int]$Port)
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        return [bool]$conn
    } catch {
        return $false
    }
}

function Show-PortConflict {
    param([int]$Port)
    Write-Host ""
    Write-Host "  [FAIL] Port $Port da duoc su dung tren may nay." -ForegroundColor Red
    Write-Host ""
    $docker = docker ps --format "{{.Names}}`t{{.Ports}}" 2>$null | Select-String ":${Port}->"
    if ($docker) {
        Write-Host "  Container Docker dang chiem port:"
        Write-Host "    $docker"
        Write-Host ""
        Write-Host "  Thu: docker compose down"
        Write-Host ""
    }
    Write-Host "  Cach xu ly:"
    Write-Host "    1) Doi port trong .env:  APP_PORT=8080"
    Write-Host "    2) Hoac dung tien trinh dang chiem port $Port"
    Write-Host ""
}

function Get-TunnelResolveIp {
    param([string]$Hostname)
    try {
        $local = Resolve-DnsName -Name $Hostname -Type A -ErrorAction Stop |
            Where-Object { $_.Type -eq 'A' } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($local) { return @{ Ip = $local; Bypass = $false } }
    } catch { }

    try {
        $public = Resolve-DnsName -Name $Hostname -Type A -Server 8.8.8.8 -ErrorAction Stop |
            Where-Object { $_.Type -eq 'A' } |
            Select-Object -First 1 -ExpandProperty IPAddress
        if ($public) { return @{ Ip = $public; Bypass = $true } }
    } catch { }

    return $null
}

function Test-TunnelHealth {
    param(
        [string]$BaseUrl,
        [int]$TimeoutSec = 15
    )
    $healthUrl = "$($BaseUrl.TrimEnd('/'))/api/health"
    $hostname = ([Uri]$healthUrl).Host

    $code = (& curl.exe -s -o NUL -w "%{http_code}" --max-time $TimeoutSec $healthUrl 2>$null)
    if ($code -eq "200") {
        return @{ Ok = $true; DnsBypass = $false }
    }

    $resolved = Get-TunnelResolveIp -Hostname $hostname
    if (-not $resolved) {
        return @{ Ok = $false; DnsBypass = $false; Code = $code }
    }

    $code = (& curl.exe -s -o NUL -w "%{http_code}" --max-time $TimeoutSec `
        --resolve "${hostname}:443:$($resolved.Ip)" $healthUrl 2>$null)
    if ($code -eq "200") {
        return @{ Ok = $true; DnsBypass = $resolved.Bypass }
    }

    return @{ Ok = $false; DnsBypass = $resolved.Bypass; Code = $code }
}

function Test-TunnelRegistered {
    $logs = docker compose logs tunnel --tail 30 2>&1 | Out-String
    return $logs -match 'Registered tunnel connection'
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  Building & starting QitekComputer..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

$ourNginx = docker compose ps nginx --status running -q 2>$null
if ((Test-PortInUse -Port $appPort) -and -not $ourNginx) {
    Show-PortConflict -Port $appPort
    exit 1
}

docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [FAIL] docker compose up that bai." -ForegroundColor Red
    if (Test-PortInUse -Port $appPort) {
        Show-PortConflict -Port $appPort
    }
    exit 1
}

$nginxRunning = docker compose ps nginx --status running -q 2>$null
if (-not $nginxRunning) {
    Write-Host ""
    Write-Host "  [FAIL] Container nginx khong chay duoc." -ForegroundColor Red
    if (Test-PortInUse -Port $appPort) {
        Show-PortConflict -Port $appPort
    }
    docker compose logs nginx --tail 20
    exit 1
}

Write-Host "  Dang cho nginx san sang..." -ForegroundColor Gray
$localReady = $false
for ($i = 0; $i -lt 30; $i++) {
    $code = (& curl.exe -s -o NUL -w "%{http_code}" --max-time 5 "http://127.0.0.1:${appPort}/api/health" 2>$null)
    if ($code -eq "200") {
        $localReady = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $localReady) {
    Write-Host ""
    Write-Host "  [FAIL] App chua phan hoi tai http://localhost:${appPort}/api/health" -ForegroundColor Red
    docker compose ps
    docker compose logs nginx --tail 15
    exit 1
}

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

$urlLogTimeout = if ($env:URL_LOG_TIMEOUT) { [int]$env:URL_LOG_TIMEOUT } else { 45 }
$urlVerifyTimeout = if ($env:URL_VERIFY_TIMEOUT) { [int]$env:URL_VERIFY_TIMEOUT } else { 60 }
$verifyInterval = if ($env:VERIFY_INTERVAL) { [int]$env:VERIFY_INTERVAL } else { 3 }

$tunnelUrl = $null
for ($i = 0; $i -lt $urlLogTimeout; $i++) {
    $logs = docker compose logs tunnel --tail 80 2>&1 | Out-String
    $urlMatches = [regex]::Matches($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($urlMatches.Count -gt 0) {
        $tunnelUrl = $urlMatches[$urlMatches.Count - 1].Value
        break
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
if ($tunnelUrl) {
    Write-Host "  Public:    " -NoNewline; Write-Host $tunnelUrl -ForegroundColor Cyan

    $verified = $false
    $dnsBypass = $false
    $elapsed = 0
    while ($elapsed -lt $urlVerifyTimeout) {
        $result = Test-TunnelHealth -BaseUrl $tunnelUrl
        if ($result.Ok) {
            $verified = $true
            $dnsBypass = $result.DnsBypass
            break
        }
        Start-Sleep -Seconds $verifyInterval
        $elapsed += $verifyInterval
    }

    if ($verified) {
        if ($dnsBypass) {
            Write-Host "             (verified - DNS mang khong resolve trycloudflare.com; URL van dung duoc tu 4G/dien thoai)" -ForegroundColor Green
        } else {
            Write-Host "             (verified)" -ForegroundColor Green
        }
    } elseif (Test-TunnelRegistered) {
        Write-Host "  [INFO] Tunnel da ket noi Cloudflare nhung may nay khong truy cap duoc URL public." -ForegroundColor Yellow
        Write-Host "         Thu mo URL tren dien thoai (4G) hoac doi DNS (vi du 8.8.8.8)." -ForegroundColor Gray
    } else {
        Write-Host "  [WARN] Tunnel URL chua phan hoi, thu lai sau hoac dung Local/LAN" -ForegroundColor Yellow
        Write-Host "         docker compose logs tunnel" -ForegroundColor Gray
    }
} else {
    Write-Host "  [WARN] Chua thay tunnel URL, app van chay Local/LAN" -ForegroundColor Yellow
    Write-Host "         docker compose logs tunnel" -ForegroundColor Gray
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
