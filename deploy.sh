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

URL_LOG_TIMEOUT=${URL_LOG_TIMEOUT:-30}        # giây chờ URL xuất hiện trong log
URL_VERIFY_TIMEOUT=${URL_VERIFY_TIMEOUT:-60}  # giây chờ URL trả 200
VERIFY_INTERVAL=${VERIFY_INTERVAL:-3}         # khoảng cách giữa các lần curl

# --- Giai đoạn 1: lấy URL từ log cloudflared ---
TUNNEL_URL=""
for i in $(seq 1 "$URL_LOG_TIMEOUT"); do
  TUNNEL_URL=$(docker compose logs tunnel 2>&1 \
    | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | head -1)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "  [FAIL] Tunnel chưa cấp URL sau ${URL_LOG_TIMEOUT}s."
  echo "         Xem log: docker compose logs tunnel"
  echo ""
  echo "========================================="
  echo ""
  exit 1
fi

# --- Giai đoạn 2: xác minh URL trả về HTTP 200 ---
echo "  Đang xác minh public URL (tối đa ${URL_VERIFY_TIMEOUT}s)..."
VERIFIED=0
ELAPSED=0
CODE=""
while [ "$ELAPSED" -lt "$URL_VERIFY_TIMEOUT" ]; do
  CODE=$(curl -s -o /dev/null -L --max-time 10 \
         -w '%{http_code}' "$TUNNEL_URL" 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    VERIFIED=1
    break
  fi
  sleep "$VERIFY_INTERVAL"
  ELAPSED=$((ELAPSED + VERIFY_INTERVAL))
done

if [ "$VERIFIED" = "1" ]; then
  echo ""
  echo "  Public:    ${TUNNEL_URL}  (verified ✓)"
  echo ""
  echo "========================================="
  echo ""
  exit 0
else
  echo ""
  echo "  [FAIL] Public URL không trả về 200 sau ${URL_VERIFY_TIMEOUT}s."
  echo "         URL:  ${TUNNEL_URL}"
  echo "         Mã HTTP cuối cùng: ${CODE:-không phản hồi}"
  echo "         Kiểm tra: docker compose logs tunnel"
  echo ""
  echo "========================================="
  echo ""
  exit 1
fi
