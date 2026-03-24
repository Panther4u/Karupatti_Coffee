#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/karupatti-coffee"

echo "=== Karupatti Coffee POS — Deploy ==="

cd "$APP_DIR"

# Pull latest (if git)
git pull origin main || echo "Not git — skipping pull"

# Backend
echo ">>> Backend setup..."
cd "$APP_DIR/Backend"
npm install --production
[ ! -f .env ] && echo "ERROR: Backend/.env missing! Create it first." && exit 1

# Frontend
echo ">>> Frontend setup..."
cd "$APP_DIR/Frontend"
npm install
[ ! -f .env.local ] && echo "ERROR: Frontend/.env.local missing! Create it first." && exit 1
echo ">>> Building frontend..."
npm run build

# Nginx (first time)
if [ ! -f /etc/nginx/sites-available/karupatti-coffee ]; then
    echo ">>> Setting up Nginx..."
    sudo cp "$APP_DIR/deploy/nginx-karupatti.conf" /etc/nginx/sites-available/karupatti-coffee
    sudo ln -sf /etc/nginx/sites-available/karupatti-coffee /etc/nginx/sites-enabled/
    sudo nginx -t && sudo systemctl reload nginx
fi

# PM2
echo ">>> Starting PM2..."
cd "$APP_DIR"
pm2 delete karupatti-api 2>/dev/null || true
pm2 delete karupatti-frontend 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || true
pm2 save

# Verify
sleep 5
HEALTH=$(curl -s http://localhost:5001/api/health 2>/dev/null || echo "FAILED")
echo "$HEALTH" | grep -q "healthy" && echo "Backend: OK" || echo "Backend: FAILED — pm2 logs karupatti-api"
FRONT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 2>/dev/null || echo "000")
[ "$FRONT" = "200" ] && echo "Frontend: OK" || echo "Frontend: FAILED — pm2 logs karupatti-frontend"

echo "=== Deploy complete! ==="
echo "Visit: http://YOUR_VPS_IP"
echo "Login with the credentials you set during setup (/api/auth/setup)"
