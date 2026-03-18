#!/bin/bash

set -a
. /app/.env
set +a

DATE=$(date +%Y-%m-%d_%H-%M-%S)

FILE="$BACKUP_PATH/${DB_NAME}_$DATE.sql"

echo "Starting backup..."

mysqldump \
-h $DB_HOST \
-P $DB_PORT \
-u $DB_USER \
-p$DB_PASSWORD \
--skip-ssl \
$DB_NAME > $FILE

if [ $? -eq 0 ]; then
  STATUS="SUCCESS"
  SIZE=$(du -h $FILE | cut -f1)
  echo "Backup SUCCESS: $FILE ($SIZE)"
else
  STATUS="FAILED"
  SIZE="0"
  echo "Backup FAILED"
fi

TIME=$(date)

python /app/send_mail.py "$STATUS" "$FILE" "$SIZE" "$TIME" || echo "Warning: Failed to send email notification"