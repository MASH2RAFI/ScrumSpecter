#!/bin/sh
# Proves a backup can be restored: downloads a day's parts from Telegram, decrypts them, restores
# into a throwaway postgres:17 container, counts rows, and removes the container again.
# Usage: sh restore-test.sh <age identity file> [YYYY-MM-DD, default: latest in the log]
# The identity (private key) file comes from your password manager; delete it after.
# Run monthly. Nothing touches the live database.
set -eu

DIR="${BACKUP_DIR:-$HOME/docker/postgres}"
. "$(dirname "$0")/telegram.sh"

IDENTITY="${1:?usage: restore-test.sh <age identity file> [YYYY-MM-DD]}"
LOG="$DIR/telegram-backups.log"
DAY="${2:-$(tail -n 1 "$LOG" | cut -f1)}"
[ -n "$DAY" ] || { echo "no backups in $LOG" >&2; exit 1; }

WORK=$(mktemp -d)
NAME="scrumspecter-restore-test-$$"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "${WORK:?}"' EXIT

# This day's parts, in order (a re-run that day uploads a second set; take the last one)
awk -F'\t' -v day="$DAY" '$1 == day' "$LOG" | tail -n "$(awk -F'\t' -v day="$DAY" '$1 == day { split($2, p, "/"); n = p[2] } END { print n + 0 }' "$LOG")" > "$WORK/parts"
[ -s "$WORK/parts" ] || { echo "no parts logged for $DAY" >&2; exit 1; }
while IFS="$(printf '\t')" read -r _ part _ id; do
    tg_download "$id" "$WORK/part.$(printf '%03d' "${part%/*}")" || { echo "download of part $part failed" >&2; exit 1; }
done < "$WORK/parts"

cat "$WORK"/part.* > "$WORK/dump.age"
EXPECTED=$(cut -f3 "$WORK/parts" | head -n 1)
[ "$(sha256sum "$WORK/dump.age" | cut -c1-16)" = "$EXPECTED" ] || { echo "checksum mismatch" >&2; exit 1; }
age -d -i "$IDENTITY" -o "$WORK/dump" "$WORK/dump.age"

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=restore-test postgres:17 >/dev/null
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
docker exec "$NAME" createdb -U postgres scrumspecter
docker cp "$WORK/dump" "$NAME":/tmp/dump
# --no-owner: the throwaway server has no scrumspecter_app role
docker exec "$NAME" pg_restore -U postgres -d scrumspecter --no-owner --no-acl /tmp/dump
docker exec "$NAME" psql -U postgres -d scrumspecter -Atc \
    "select 'users ' || count(*) from users union all select 'workspaces ' || count(*) from workspaces union all select 'tasks ' || count(*) from tasks"
echo "restore of $DAY worked"
