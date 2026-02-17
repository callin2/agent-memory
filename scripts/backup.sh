#!/bin/bash

#
# Thread's Memory System - Backup Script
#
# Automated backup script for database and exports.
# Suitable for cron jobs or manual execution.
#
# Usage:
#   ./scripts/backup.sh                    # Full backup (database + exports)
#   ./scripts/backup.sh --database         # Database only
#   ./scripts/backup.sh --exports          # Exports only
#   ./scripts/backup.sh --tenant default   # Backup specific tenant
#
# Cron examples:
#   # Daily backup at 2 AM
#   0 2 * * * /opt/agent-memory/scripts/backup.sh
#
#   # Hourly incremental backups
#   0 * * * * /opt/agent-memory/scripts/backup.sh --exports
#

set -e

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
API_BASE="${API_BASE:-http://localhost:3456}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE=$(date +%Y%m%d)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Parse arguments
BACKUP_DATABASE=true
BACKUP_EXPORTS=true
TENANT_ID="${DEFAULT_TENANT:-default}"

while [[ $# -gt 0 ]]; do
    case $1 in
        --database)
            BACKUP_DATABASE=true
            BACKUP_EXPORTS=false
            shift
            ;;
        --exports)
            BACKUP_DATABASE=false
            BACKUP_EXPORTS=true
            shift
            ;;
        --tenant)
            TENANT_ID="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --database        Backup database only"
            echo "  --exports         Backup exports only"
            echo "  --tenant ID       Backup specific tenant (default: default)"
            echo "  -h, --help        Show this help message"
            echo ""
            echo "Environment variables:"
            echo "  BACKUP_DIR        Backup directory (default: ./backups)"
            echo "  RETENTION_DAYS    Days to keep backups (default: 30)"
            echo "  API_BASE          API base URL (default: http://localhost:3456)"
            echo "  DEFAULT_TENANT    Default tenant ID (default: default)"
            echo "  PGDATABASE        Database name (required for database backup)"
            echo "  PGHOST            Database host (default: localhost)"
            echo "  PGPORT            Database port (default: 5432)"
            echo "  PGUSER            Database user (default: postgres)"
            echo "  PGPASSWORD        Database password (required)"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use -h or --help for usage information"
            exit 1
            ;;
    esac
done

log_info "Thread's Memory System - Backup Script"
log_info "Timestamp: $TIMESTAMP"
echo ""

# Backup database
if [ "$BACKUP_DATABASE" = true ]; then
    if [ -z "$PGDATABASE" ]; then
        log_error "PGDATABASE environment variable not set"
        exit 1
    fi

    log_info "Backing up database: $PGDATABASE"

    DATABASE_BACKUP="$BACKUP_DIR/database_${DATE}_${TIMESTAMP}.sql.gz"

    if ! pg_dump -h "${PGHOST:-localhost}" \
                  -p "${PGPORT:-5432}" \
                  -U "${PGUSER:-postgres}" \
                  -d "$PGDATABASE" \
                  --no-owner \
                  --no-acl 2>/dev/null | gzip > "$DATABASE_BACKUP"; then
        log_error "Database backup failed"
        exit 1
    fi

    BACKUP_SIZE=$(du -h "$DATABASE_BACKUP" | cut -f1)
    log_info "Database backup created: $DATABASE_BACKUP ($BACKUP_SIZE)"
fi

# Backup exports
if [ "$BACKUP_EXPORTS" = true ]; then
    log_info "Backing up tenant exports: $TENANT_ID"

    EXPORT_BACKUP="$BACKUP_DIR/export_${TENANT_ID}_${DATE}_${TIMESTAMP}.json.gz"

    if ! curl -s "${API_BASE}/api/v1/export/all?tenant_id=${TENANT_ID}&include_events=true" \
            | gzip > "$EXPORT_BACKUP"; then
        log_error "Export backup failed"
        exit 1
    fi

    BACKUP_SIZE=$(du -h "$EXPORT_BACKUP" | cut -f1)
    log_info "Export backup created: $EXPORT_BACKUP ($BACKUP_SIZE)"
fi

# Clean old backups
log_info "Cleaning backups older than $RETENTION_DAYS days"

# Remove old database backups
find "$BACKUP_DIR" -name "database_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Remove old export backups
find "$BACKUP_DIR" -name "export_*.json.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
REMAINING=$(find "$BACKUP_DIR" -type f | wc -l)
log_info "Remaining backups: $REMAINING"

# Create backup manifest
MANIFEST="$BACKUP_DIR/manifest_${DATE}_${TIMESTAMP}.txt"
cat > "$MANIFEST" << EOF
Backup Manifest
Generated: $(date)
Hostname: $(hostname)
Database: ${PGDATABASE:-N/A}
Tenant: $TENANT_ID

Files:
$(find "$BACKUP_DIR" -maxdepth 1 -type f -newermt "$DATE" -ls 2>/dev/null || true)

Disk Usage:
$(du -sh "$BACKUP_DIR" 2>/dev/null || true)
EOF

log_info "Backup manifest created: $MANIFEST"

echo ""
log_info "✅ Backup completed successfully!"
log_info "Backups stored in: $BACKUP_DIR"
