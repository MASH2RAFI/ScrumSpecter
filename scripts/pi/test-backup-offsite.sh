#!/bin/sh
# Checks when backup-offsite.sh uploads (every TELEGRAM_BACKUP_EVERY_DAYS days), with a fake Telegram
# and a fake age. Run anywhere with GNU date:  sh scripts/pi/test-backup-offsite.sh
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
T=$(mktemp -d)
trap 'rm -rf "${T:?}"' EXIT

cp "$HERE/backup-offsite.sh" "$T/"
cat > "$T/telegram.sh" <<'SH'
tg_send() { echo "$1" >> "$SENT"; }
tg_send_file() { echo "file-id-$(basename "$1")"; }
SH
mkdir -p "$T/bin"
printf '#!/bin/sh\n# fake age: -R key -o out in\ncp "$5" "$4"\n' > "$T/bin/age"
chmod +x "$T/bin/age"
echo "fake-public-key" > "$T/backup-age.pub"
echo "dump contents" > "$T/dump"

export PATH="$T/bin:$PATH" SCRUMSPECTER_PI_DIR="$T" SENT="$T/sent"
fails=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1 (expected $3, got $2)"; fails=$((fails + 1)); fi; }
day_ago() { date -d "$1 days ago" +%F; }
uploads() { grep -c "	1/" "$T/telegram-backups.log" 2>/dev/null || true; }
run() { : > "$SENT"; sh "$T/backup-offsite.sh" "$T/dump" > "$T/out" 2>&1 || true; }

rm -f "$T/telegram-backups.log"; run
check "no log yet: uploads" "$(uploads)" 1

printf '%s\t1/1\thash\tid\n' "$(day_ago 1)" > "$T/telegram-backups.log"; run
check "uploaded yesterday: skipped" "$(uploads)" 1
check "skip is said" "$(grep -c skipped "$T/out")" 1

printf '%s\t1/1\thash\tid\n' "$(day_ago 16)" > "$T/telegram-backups.log"; run
check "16 days old, every 15: uploads" "$(uploads)" 2
check "latest line is today" "$(tail -n 1 "$T/telegram-backups.log" | cut -f1)" "$(date +%F)"

printf '%s\t1/1\thash\tid\n' "$(day_ago 16)" > "$T/telegram-backups.log"
TELEGRAM_BACKUP_EVERY_DAYS=30 run
check "16 days old, every 30: skipped" "$(uploads)" 1

printf '%s\t1/1\thash\tid\n' "$(day_ago 1)" > "$T/telegram-backups.log"
FORCE=1 run
check "FORCE uploads anyway" "$(uploads)" 2

TELEGRAM_BACKUP_EVERY_DAYS=often run
check "a bad setting fails" "$(grep -c 'failed' "$SENT")" 1

[ "$fails" = 0 ] && echo "all passed"
exit "$fails"
