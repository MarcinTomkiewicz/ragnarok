#!/usr/bin/env bash
set -euo pipefail

DEPLOY_ROOT="/var/www/ragnarok"
BACKUP_ROOT="/var/www/ragnarok/backup"
KEEP_BACKUPS=5
ARCHIVE_PATH="${1:-/tmp/ragnarok-dist.tgz}"

umask 022
mkdir -p "$DEPLOY_ROOT" "$BACKUP_ROOT"

STAMP="$(date +%F_%H-%M-%S)"
mkdir -p "$BACKUP_ROOT/$STAMP"

echo "[deploy] backing up current browser/server to $BACKUP_ROOT/$STAMP"
if [ -d "$DEPLOY_ROOT/browser" ]; then
  mv "$DEPLOY_ROOT/browser" "$BACKUP_ROOT/$STAMP/browser"
fi
if [ -d "$DEPLOY_ROOT/server" ]; then
  mv "$DEPLOY_ROOT/server" "$BACKUP_ROOT/$STAMP/server"
fi

echo "[deploy] extracting new dist to $DEPLOY_ROOT"
# Archiwum zawiera katalogi top-level: browser i server
tar xzf "$ARCHIVE_PATH" -C "$DEPLOY_ROOT"

# Retencja backupów (zostaw ostatnie 5)
(ls -1dt "$BACKUP_ROOT"/* 2>/dev/null || true) | tail -n +$((KEEP_BACKUPS+1)) | xargs -r rm -rf || true

echo "[deploy] restarting pm2"
/usr/bin/pm2 restart ragnarok-ssr

echo "[deploy] done"
