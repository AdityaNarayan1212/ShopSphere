#!/usr/bin/env bash
set -euo pipefail

# Idempotent bootstrap script for a fresh Ubuntu 24.04 EC2 instance (t3.micro, 1 GB RAM)

echo "==> [1/6] Configuring 2 GB swapfile..."
if ! swapon --show | grep -q '/swapfile'; then
  if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi
  sudo swapon /swapfile
fi
if ! grep -q '^/swapfile ' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi
sudo sysctl vm.swappiness=10 >/dev/null
if ! grep -q '^vm.swappiness=' /etc/sysctl.conf; then
  echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf >/dev/null
fi

echo "==> [2/6] Installing system packages (git, nginx, postgresql-client, curl, ca-certificates, gnupg)..."
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git \
  nginx \
  postgresql-client \
  curl \
  ca-certificates \
  gnupg

echo "==> [3/6] Installing Node.js 20 LTS via NodeSource..."
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20\.'; then
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | sudo gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" \
    | sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi
echo "Node version: $(node -v), npm version: $(npm -v)"

echo "==> [4/6] Installing PM2 globally and enabling startup service..."
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME="$(eval echo "~${TARGET_USER}")"
sudo env PATH="$PATH:/usr/bin:/usr/local/bin" pm2 startup systemd -u "${TARGET_USER}" --hp "${TARGET_HOME}" >/dev/null || true

echo "==> [5/6] Preparing web root /var/www/shopsphere..."
sudo mkdir -p /var/www/shopsphere
sudo chown -R "${TARGET_USER}:www-data" /var/www/shopsphere
sudo chmod -R 755 /var/www/shopsphere

echo "==> [6/6] Enabling and starting Nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

echo "==> EC2 bootstrap complete."
