#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$HOME/apps/react-app"
WEB_ROOT="/var/www/html"
API_BASE="https://kailospay.cafe24.com"

cd "$APP_DIR"

echo "▶ clean & build"
rm -rf dist
VITE_API_BASE="$API_BASE" npm run build

echo "▶ deploy (rsync → /var/www/html)"
sudo rsync -a --delete dist/ "$WEB_ROOT"/

echo "▶ stamp"
printf '<!-- build: %s -->\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" | \
  sudo tee -a "$WEB_ROOT/index.html" >/dev/null

echo "▶ quick check"
curl -s "$API_BASE/index.html" | tail -n2
curl -I "$API_BASE/index.html" | sed -n '1,10p'
echo "Done. Open: $API_BASE/?v=$(date +%s)"
