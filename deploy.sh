#!/bin/bash
set -e

# Load .env
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

FRONTEND_PORT=${FRONTEND_PORT:-3000}
BACKEND_PORT=${BACKEND_PORT:-8000}

echo ""
echo "========================================="
echo "  Building & starting QitekShop..."
echo "========================================="
echo ""

docker compose -f docker-compose.prod.yml up --build -d

# Get local IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || ipconfig 2>/dev/null | grep -m1 "IPv4" | awk '{print $NF}')

echo ""
echo "========================================="
echo "  QitekShop is running!"
echo "========================================="
echo ""
echo "  Frontend:  http://${LOCAL_IP}:${FRONTEND_PORT}"
echo "  Backend:   http://${LOCAL_IP}:${BACKEND_PORT}"
echo ""
echo "  Other devices on the same network"
echo "  can access the URLs above."
echo ""
echo "========================================="
echo ""
