#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/ragnarok/app"
DEPLOY_ROOT="/var/www/ragnarok"
BACKUP_ROOT="/var/www/ragnarok/backup"
KEEP_BACKUPS=5
ARCHIVE_PATH="${1:-/tmp/ragnarok-src.tgz}"

umask 022
mkdir -p "$APP_DIR" "$BACKUP_ROOT" "$DEPLOY_ROOT"

echo "[deploy] extracting sources to $APP_DIR"
rm -rf "$APP_DIR"/*
tar xzf "$ARCHIVE_PATH" -C "$APP_DIR"

cd "$APP_DIR"
if [ -f package-lock.json ]; then
  echo "[deploy] npm ci"
  npm ci --no-audit --no-fund
else
  echo "[deploy] npm install"
  npm install --no-audit --no-fund
fi

echo "[deploy] building (npm run build:ssr)"
npm run build:ssr

STAMP="$(date +%F_%H-%M-%S)"
mkdir -p "$BACKUP_ROOT/$STAMP"

# Backup obecnych katalogów
if [ -d "$DEPLOY_ROOT/browser" ]; then
  mv "$DEPLOY_ROOT/browser" "$BACKUP_ROOT/$STAMP/browser"
fi
if [ -d "$DEPLOY_ROOT/server" ]; then
  mv "$DEPLOY_ROOT/server" "$BACKUP_ROOT/$STAMP/server"
fi

# Wgranie nowych artefaktów
cp -a "dist/ragnarok/browser" "$DEPLOY_ROOT/browser"
cp -a "dist/ragnarok/server" "$DEPLOY_ROOT/server"

# Retencja backupów
(ls -1dt "$BACKUP_ROOT"/* 2>/dev/null || true) | tail -n +$((KEEP_BACKUPS+1)) | xargs -r rm -rf || true

echo "[deploy] restarting pm2"
/usr/bin/pm2 restart ragnarok-ssr

echo "[deploy] done"
