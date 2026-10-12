#!/usr/bin/env bash
# Sauvegarde : base PostgreSQL (pg_dump) + fichiers en stockage local.
# Usage : DATABASE_URL=... STORAGE_DIR=./storage BACKUP_DIR=/var/backups/vadc ./scripts/backup.sh
# Planification conseillée (cron, chaque nuit) :  15 3 * * *  /chemin/scripts/backup.sh
# Avec STORAGE_DRIVER=s3, activez plutôt le versionnage / la réplication du bucket.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL requis}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STORAGE_DIR="${STORAGE_DIR:-./storage}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$BACKUP_DIR/db-$STAMP.dump"
if [ -d "$STORAGE_DIR" ]; then
  tar -czf "$BACKUP_DIR/storage-$STAMP.tar.gz" -C "$(dirname "$STORAGE_DIR")" "$(basename "$STORAGE_DIR")"
fi
# Rotation
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'storage-*.tar.gz' \) -mtime "+$RETENTION_DAYS" -delete
echo "Sauvegarde terminée : $BACKUP_DIR (*-$STAMP)"
# Restauration : pg_restore --clean --no-owner --dbname="$DATABASE_URL" db-AAAAMMJJ-HHMMSS.dump
