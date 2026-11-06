#!/bin/sh
# Sends a dump off the Pi: encrypted with age, posted to the private Telegram channel. Called at the
# end of backup.sh every night with the dump it just wrote:  sh backup-offsite.sh /path/to/dump
# It uploads only when the last upload is TELEGRAM_BACKUP_EVERY_DAYS old (default 15; set 30 in
# telegram.env for monthly), and keeps trying every night until one succeeds. The nightly local dumps
# are untouched. FORCE=1 uploads now.
# Needs: curl, age, split, sha256sum. Only the age PUBLIC key is on the Pi (backup-age.pub);
# the private key lives in your password manager, so a stolen Pi can't read old backups.
# Every failure sends "❌ backup failed: <step>" through the same bot.
set -eu

DIR="${SCRUMSPECTER_PI_DIR:-$HOME/docker/postgres}"
. "$(dirname "$0")/telegram.sh"

DUMP="${1:?usage: backup-offsite.sh <dump file>}"
RECIPIENT_FILE="${AGE_RECIPIENT_FILE:-$DIR/backup-age.pub}"
LOG="$DIR/telegram-backups.log"
# The Bot API uploads up to 50 MB but downloads only up to 20 MB, so parts stay under that
PART_SIZE="${PART_SIZE:-19M}"
DAY=$(date +%F)
EVERY="${TELEGRAM_BACKUP_EVERY_DAYS:-15}"

fail() { tg_send "❌ scrumspecter backup failed: $1 ($DAY)" || true; echo "backup failed: $1" >&2; exit 1; }

case "$EVERY" in ''|*[!0-9]*) fail "TELEGRAM_BACKUP_EVERY_DAYS must be a whole number of days" ;; esac

# The day of the last complete upload (the log is written only after every part is up)
last_upload() { [ -s "$LOG" ] && tail -n 1 "$LOG" | cut -f1 || true; }
days_since() { echo $(( ( $(date +%s) - $(date -d "$1" +%s) ) / 86400 )); }

LAST=$(last_upload)
DUE=1
if [ -n "$LAST" ] && [ "${FORCE:-0}" != 1 ] && [ "$(days_since "$LAST")" -lt "$EVERY" ]; then
    DUE=0
    echo "telegram upload skipped: last one $LAST, every $EVERY days"
fi

if [ "$DUE" = 1 ]; then
[ -s "$DUMP" ] || fail "dump missing or empty"
[ -r "$RECIPIENT_FILE" ] || fail "age public key missing"

WORK=$(mktemp -d)
trap 'rm -rf "${WORK:?}"' EXIT

ENC="$WORK/scrumspecter-$DAY.dump.age"
age -R "$RECIPIENT_FILE" -o "$ENC" "$DUMP" || fail "encryption"
SIZE=$(du -h "$ENC" | cut -f1)
HASH=$(sha256sum "$ENC" | cut -c1-16)

split -b "$PART_SIZE" -d -a 2 "$ENC" "$ENC.part" || fail "split"
PARTS=$(ls "$ENC".part* | wc -l)
N=0
# The log is written only after every part is up: a failed night must not leave half a day in it
# (the restore test would take that incomplete day as the latest)
LINES="$WORK/log-lines"
: > "$LINES"
for part in "$ENC".part*; do
    N=$((N + 1))
    id=$(tg_send_file "$part" "scrumspecter · $DAY · $SIZE · sha256 $HASH · part $N/$PARTS") || true
    [ -n "$id" ] || fail "upload of part $N/$PARTS"
    # The Bot API can't list old messages, so this log is how a restore finds a day's parts
    printf '%s\t%s/%s\t%s\t%s\n' "$DAY" "$N" "$PARTS" "$HASH" "$id" >> "$LINES"
done
cat "$LINES" >> "$LOG"
tg_send "✅ scrumspecter: backup uploaded ($SIZE). Next one in $EVERY days." || true
fi

# A weekly sign of life on Sundays, so a silent bot still means the job is running
if [ "$(date +%u)" = 7 ]; then
    LAST=$(last_upload)
    if [ -n "$LAST" ]; then
        tg_send "✅ scrumspecter: still running. Last Telegram backup $LAST ($(days_since "$LAST") days ago, one every $EVERY days)." || true
    else
        tg_send "⚠️ scrumspecter: no Telegram backup uploaded yet." || true
    fi
fi
