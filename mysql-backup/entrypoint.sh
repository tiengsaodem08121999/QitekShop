#!/bin/bash

set -a
. /app/.env
set +a

echo "Starting MySQL Backup Service"

mkdir -p $BACKUP_PATH

echo "$CRON_TIME /app/backup.sh >> /var/log/backup.log 2>&1" > /etc/cron.d/backup
chmod 0644 /etc/cron.d/backup
crontab /etc/cron.d/backup

echo "Backup schedule: $CRON_TIME"

cron -f
