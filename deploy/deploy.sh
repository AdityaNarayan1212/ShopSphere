#!/usr/bin/env bash
set -euo pipefail

# Idempotent deployment script for ShopSphere on Ubuntu 24.04 EC2
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WEB_ROOT="/var/www/shopsphere"

cd "${REPO_ROOT}"

if [ ! -f "${REPO_ROOT}/server/.env" ]; then
  echo "ERROR: ${REPO_ROOT}/server/.env not found. Copy server/.env.production.example to server/.env and fill in production values first." >&2
  exit 1
fi

echo "==> [1/8] Pulling latest code..."
git pull --ff-only

echo "==> [2/8] Installing workspace dependencies..."
npm install

echo "==> [3/8] Generating Prisma client and deploying migrations..."
npx --workspace server prisma generate
npx --workspace server prisma migrate deploy

echo "==> [4/8] Building backend (server)..."
npm run build --workspace server

echo "==> [5/8] Building frontend (client) with VITE_API_URL=/api..."
VITE_API_URL=/api npm run build --workspace client

echo "==> [6/8] Publishing client/dist to ${WEB_ROOT}..."
sudo mkdir -p "${WEB_ROOT}"
sudo rm -rf "${WEB_ROOT:?}"/*
sudo cp -r "${REPO_ROOT}/client/dist/"* "${WEB_ROOT}/"
sudo chown -R www-data:www-data "${WEB_ROOT}"

echo "==> [7/8] Reloading PM2 app (api) and Nginx..."
if pm2 describe api >/dev/null 2>&1; then
  pm2 reload "${REPO_ROOT}/deploy/ecosystem.config.cjs" --update-env
else
  pm2 start "${REPO_ROOT}/deploy/ecosystem.config.cjs"
fi
pm2 save

sudo cp "${REPO_ROOT}/deploy/nginx.conf" /etc/nginx/sites-available/shopsphere.conf
sudo ln -sf /etc/nginx/sites-available/shopsphere.conf /etc/nginx/sites-enabled/shopsphere.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo "==> [8/8] Verifying /api/health..."
sleep 2
HEALTH_RESPONSE="$(curl -fsSL http://127.0.0.1/api/health)"
echo "Health check response: ${HEALTH_RESPONSE}"
