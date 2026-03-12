#!/bin/bash
set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

APP_PORT=${APP_PORT:-80}

echo ""
echo "========================================="
echo "  Building & starting QitekShop..."
echo "========================================="
echo ""

docker compose up --build -d

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig 2>/dev/null | grep -m1 "IPv4" | awk '{print $NF}')

echo ""
echo "========================================="
echo "  QitekShop is running!"
echo "========================================="
echo ""
echo "  Local:     http://localhost:${APP_PORT}"
echo "  LAN:       http://${LOCAL_IP}:${APP_PORT}"
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
