#!/bin/bash

# Load .env
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

APP_PORT=${APP_PORT:-80}

echo ""
echo "========================================="
echo "  Building & starting QitekComputer..."
echo "========================================="
echo ""

docker compose up --build -d

# Get local IP (Windows compatible)
LOCAL_IP=""
if command -v powershell.exe &>/dev/null; then
  LOCAL_IP=$(powershell.exe -NoProfile -Command "
    (Get-NetIPAddress -AddressFamily IPv4 |
     Where-Object { \$_.InterfaceAlias -notmatch 'Loopback|vEthernet|Docker|WSL' -and \$_.IPAddress -notmatch '^127\.' } |
     Select-Object -First 1).IPAddress
  " 2>/dev/null | tr -d '\r\n')
fi
if [ -z "$LOCAL_IP" ]; then
  LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
LOCAL_IP=${LOCAL_IP:-localhost}

MYSQL_PORT=${MYSQL_PORT:-3306}
MYSQL_DATABASE=${MYSQL_DATABASE:-qitekcomputer}

echo ""
echo "========================================="
echo "  QitekComputer is running!"
echo "========================================="
echo ""
echo "  Local:     http://localhost:${APP_PORT}"
echo "  LAN:       http://${LOCAL_IP}:${APP_PORT}"
echo ""
echo "  ---- Database Connection ----"
echo "  Host:      ${LOCAL_IP}"
echo "  Port:      ${MYSQL_PORT}"
echo "  Database:  ${MYSQL_DATABASE}"
echo "  User:      root"
echo "  Password:  ${MYSQL_ROOT_PASSWORD}"
echo ""
echo "  Waiting for tunnel URL..."
echo ""

# Wait for cloudflared to print the tunnel URL
for i in $(seq 1 30); do
  TUNNEL_URL=$(docker compose logs tunnel 2>&1 | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    echo "  Public:    ${TUNNEL_URL}"
    echo ""
    break
  fi
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "  Run 'docker compose logs tunnel' to find the public URL"
  echo ""
fi

echo "========================================="
echo ""
