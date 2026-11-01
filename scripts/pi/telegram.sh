#!/bin/sh
# Shared by the Pi scripts: loads the bot's settings and sends messages/files to the private channel.
# Settings (owner-only file, never committed): ~/docker/postgres/telegram.env with
#   TELEGRAM_BOT_TOKEN=...   TELEGRAM_CHAT_ID=...
# Never echo the token: it is part of every API URL.

TELEGRAM_ENV="${TELEGRAM_ENV:-$HOME/docker/postgres/telegram.env}"
# Overridable only so the scripts can be tested against a fake server
TELEGRAM_API="${TELEGRAM_API:-https://api.telegram.org}"

[ -r "$TELEGRAM_ENV" ] || { echo "missing $TELEGRAM_ENV" >&2; exit 1; }
# shellcheck disable=SC1090
. "$TELEGRAM_ENV"
[ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || { echo "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set" >&2; exit 1; }

tg_send() { # text
    curl -sS --max-time 30 -o /dev/null -w '%{http_code}' \
        --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" --data-urlencode "text=$1" \
        "$TELEGRAM_API/bot$TELEGRAM_BOT_TOKEN/sendMessage" | grep -q '^200$'
}

tg_send_file() { # path caption -> prints the file_id
    curl -sS --max-time 300 -F "chat_id=$TELEGRAM_CHAT_ID" -F "caption=$2" -F "document=@$1" \
        "$TELEGRAM_API/bot$TELEGRAM_BOT_TOKEN/sendDocument" |
        # The document's own id comes after any thumbnail's, so take the last one
        grep -o '"file_id": *"[^"]*"' | tail -n 1 | sed 's/.*"\([^"]*\)"$/\1/'
}

tg_download() { # file_id output-path   (the Bot API serves files up to 20 MB)
    path=$(curl -sS --max-time 60 "$TELEGRAM_API/bot$TELEGRAM_BOT_TOKEN/getFile?file_id=$1" |
        grep -o '"file_path": *"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')
    [ -n "$path" ] || return 1
    curl -sS --max-time 300 -fo "$2" "$TELEGRAM_API/file/bot$TELEGRAM_BOT_TOKEN/$path"
}
