#!/bin/sh
# Warns through the Telegram bot when the database disk is filling up. Run from cron, e.g. hourly:
#   0 * * * * sh /home/<ssh-user>/docker/postgres/disk-alert.sh
# Alerts at most once a day per disk, so a full disk doesn't send a message every hour.
set -eu

DIR="${BACKUP_DIR:-$HOME/docker/postgres}"
. "$(dirname "$0")/telegram.sh"

LIMIT="${DISK_ALERT_PERCENT:-80}"
STATE="$DIR/disk-alert.last"

for mount in ${DISK_ALERT_MOUNTS:-/mnt/pgdata /mnt/torrents}; do
    used=$(df -P "$mount" | awk 'NR == 2 { sub("%", "", $5); print $5 }')
    key="$(date +%F) $mount"
    if [ "$used" -ge "$LIMIT" ] && ! grep -qxF "$key" "$STATE" 2>/dev/null; then
        tg_send "⚠️ scrumspecter: $mount is $used% full (limit $LIMIT%)" && echo "$key" >> "$STATE"
    fi
done
