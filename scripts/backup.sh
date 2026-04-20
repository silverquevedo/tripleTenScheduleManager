#!/usr/bin/env bash
# Backup the Schedule Manager SQLite database with a timestamp.
# Usage:  npm run db:backup
#         ./scripts/backup.sh
#
# Backups are stored in prisma/backups/ — add that folder to .gitignore if needed.

set -euo pipefail

DB="$(dirname "$0")/../prisma/dev.db"
BACKUP_DIR="$(dirname "$0")/../prisma/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DEST="$BACKUP_DIR/dev_$TIMESTAMP.db"

if [ ! -f "$DB" ]; then
  echo "ERROR: database not found at $DB"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

# Use sqlite3 ".backup" command if available — it creates a consistent snapshot.
if command -v sqlite3 &> /dev/null; then
  sqlite3 "$DB" ".backup '$DEST'"
else
  cp "$DB" "$DEST"
fi

SIZE=$(du -sh "$DEST" | cut -f1)
echo "Backup created: $DEST ($SIZE)"

# Keep only the 20 most recent backups to avoid bloat
ls -t "$BACKUP_DIR"/dev_*.db 2>/dev/null | tail -n +21 | xargs rm -f --

echo "Done. Run 'npm run db:backup' any time before making bulk changes."
