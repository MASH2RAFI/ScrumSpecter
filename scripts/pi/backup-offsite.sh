#!/bin/sh
# Sends one night's dump off the Pi: encrypted with age, posted to the private Telegram channel.
# Called at the end of backup.sh with the dump it just wrote:  sh backup-offsite.sh /path/to/dump
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

fail() { tg_send "❌ scrumspecter backup failed: $1 ($DAY)" || true; echo "backup failed: $1" >&2; exit 1; }

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
for part in "$ENC".part*; do
    N=$((N + 1))
    id=$(tg_send_file "$part" "scrumspecter · $DAY · $SIZE · sha256 $HASH · part $N/$PARTS") || true
    [ -n "$id" ] || fail "upload of part $N/$PARTS"
    # The Bot API can't list old messages, so this log is how a restore finds a day's parts
    printf '%s\t%s/%s\t%s\t%s\n' "$DAY" "$N" "$PARTS" "$HASH" "$id" >> "$LOG"
done

# A weekly sign of life on Sundays
if [ "$(date +%u)" = 7 ]; then
    WEEK=$(awk -F'\t' -v since="$(date -d '6 days ago' +%F)" '$1 >= since && $2 ~ /^1\// { n++ } END { print n + 0 }' "$LOG")
    tg_send "✅ scrumspecter: $WEEK backups this week, latest $SIZE" || true
fi
