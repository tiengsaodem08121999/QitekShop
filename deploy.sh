#!/bin/bash
set -euo pipefail

# Load .env
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

APP_PORT=${APP_PORT:-80}

port_in_use() {
  local port="$1"
  if command -v ss &>/dev/null; then
    ss -tlnH "sport = :$port" 2>/dev/null | grep -q .
    return $?
  fi
  if command -v netstat &>/dev/null; then
    netstat -tln 2>/dev/null | grep -q ":${port} "
    return $?
  fi
  return 1
}

show_port_conflict() {
  echo ""
  echo "  [FAIL] Port ${APP_PORT} đã được sử dụng trên máy này."
  echo ""
  if command -v docker &>/dev/null; then
    EXISTING=$(docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null | grep -E ":${APP_PORT}->" || true)
    if [ -n "$EXISTING" ]; then
      echo "  Container Docker đang chiếm port:"
      echo "    $EXISTING"
      echo ""
      echo "  Thử: docker compose down"
      echo ""
    fi
  fi
  if command -v ss &>/dev/null; then
    echo "  Tiến trình đang lắng nghe:"
    ss -tlnp 2>/dev/null | grep ":${APP_PORT} " || true
    echo ""
  fi
  echo "  Cách xử lý:"
  echo "    1) Dừng dịch vụ chiếm port (thường là apache2/nginx trên VM):"
  echo "       sudo systemctl stop apache2   # hoặc: sudo systemctl stop nginx"
  echo "    2) Hoặc đổi port trong .env:  APP_PORT=8080"
  echo ""
}

resolve_tunnel_ip() {
  local host="$1"
  local ip=""
  ip=$(getent hosts "$host" 2>/dev/null | awk '{print $1}' | head -1)
  if [ -n "$ip" ]; then
    echo "$ip"
    return 0
  fi
  ip=$(nslookup "$host" 8.8.8.8 2>/dev/null | awk '/^Address: / { print $2 }' | tail -1)
  echo "$ip"
}

curl_tunnel_health() {
  local url="$1"
  local host ip code
  host=$(echo "$url" | sed -E 's|https?://([^/]+).*|\1|')
  code=$(curl -s -o /dev/null -L --max-time 15 -w '%{http_code}' "$url" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "200|0"
    return 0
  fi
  ip=$(resolve_tunnel_ip "$host")
  if [ -z "$ip" ]; then
    echo "${code:-000}|0"
    return 1
  fi
  code=$(curl -s -o /dev/null -L --max-time 15 -w '%{http_code}' \
    --resolve "${host}:443:${ip}" "$url" 2>/dev/null)
  if [ "$code" = "200" ]; then
    echo "200|1"
    return 0
  fi
  echo "${code:-000}|1"
  return 1
}

tunnel_registered() {
  docker compose logs tunnel --tail 30 2>&1 | grep -q 'Registered tunnel connection'
}

echo ""
echo "========================================="
echo "  Building & starting QitekComputer..."
echo "========================================="
echo ""

if port_in_use "$APP_PORT"; then
  OUR_NGINX=$(docker compose ps nginx --status running -q 2>/dev/null || true)
  if [ -z "$OUR_NGINX" ]; then
    show_port_conflict
    exit 1
  fi
fi

if ! docker compose up --build -d; then
  echo ""
  echo "  [FAIL] docker compose up thất bại."
  if port_in_use "$APP_PORT"; then
    show_port_conflict
  fi
  exit 1
fi

if ! docker compose ps nginx --status running -q 2>/dev/null | grep -q .; then
  echo ""
  echo "  [FAIL] Container nginx không chạy được."
  if port_in_use "$APP_PORT"; then
    show_port_conflict
  fi
  echo "  Log nginx:"
  docker compose logs nginx --tail 20 2>&1 || true
  exit 1
fi

echo "  Đang chờ nginx sẵn sàng..."
LOCAL_READY=0
for _ in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null --max-time 5 -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/api/health" 2>/dev/null || true)
  if [ "$CODE" = "200" ]; then
    LOCAL_READY=1
    break
  fi
  sleep 2
done

if [ "$LOCAL_READY" != "1" ]; then
  echo ""
  echo "  [FAIL] App chưa phản hồi tại http://localhost:${APP_PORT}/api/health"
  docker compose ps
  docker compose logs nginx --tail 15 2>&1 || true
  docker compose logs backend --tail 15 2>&1 || true
  exit 1
fi

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

URL_LOG_TIMEOUT=${URL_LOG_TIMEOUT:-45}
URL_VERIFY_TIMEOUT=${URL_VERIFY_TIMEOUT:-60}
VERIFY_INTERVAL=${VERIFY_INTERVAL:-3}

TUNNEL_URL=""
for _ in $(seq 1 "$URL_LOG_TIMEOUT"); do
  TUNNEL_URL=$(docker compose logs tunnel --tail 80 2>&1 \
    | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

if [ -z "$TUNNEL_URL" ]; then
  echo "  [WARN] Tunnel chưa cấp URL sau ${URL_LOG_TIMEOUT}s."
  echo "         App vẫn chạy tại Local/LAN ở trên."
  echo "         Xem log: docker compose logs tunnel"
  echo ""
  echo "========================================="
  echo ""
  exit 0
fi

VERIFY_URL="${TUNNEL_URL%/}/api/health"
echo "  Đang xác minh public URL (tối đa ${URL_VERIFY_TIMEOUT}s)..."
VERIFIED=0
DNS_BYPASS=0
ELAPSED=0
CODE=""
while [ "$ELAPSED" -lt "$URL_VERIFY_TIMEOUT" ]; do
  RESULT=$(curl_tunnel_health "$VERIFY_URL" || echo "000|0")
  CODE="${RESULT%%|*}"
  DNS_BYPASS="${RESULT##*|}"
  if [ "$CODE" = "200" ]; then
    VERIFIED=1
    break
  fi
  sleep "$VERIFY_INTERVAL"
  ELAPSED=$((ELAPSED + VERIFY_INTERVAL))
done

echo ""
if [ "$VERIFIED" = "1" ]; then
  echo "  Public:    ${TUNNEL_URL}  (verified ✓)"
  if [ "$DNS_BYPASS" = "1" ]; then
    echo "             DNS mạng không resolve trycloudflare.com; URL vẫn dùng được từ 4G/điện thoại"
  fi
elif tunnel_registered; then
  echo "  Public:    ${TUNNEL_URL}"
  echo "  [INFO] Tunnel đã kết nối Cloudflare nhưng máy này không truy cập được URL public."
  echo "         Thử mở URL trên điện thoại (4G) hoặc đổi DNS (ví dụ 8.8.8.8)."
else
  echo "  [FAIL] Public URL không trả về 200 sau ${URL_VERIFY_TIMEOUT}s."
  echo "         URL:  ${TUNNEL_URL}"
  echo "         Mã HTTP cuối cùng: ${CODE:-000}"
  echo "         Kiểm tra: docker compose logs tunnel"
  echo "         Local health: curl http://localhost:${APP_PORT}/api/health"
fi
echo ""
echo "========================================="
echo ""
exit 0
