#!/bin/sh
# One-time setup on the Pi for off-site backups, alerts and database limits (see docs/self-hosting.md).
# Run from the repo on your desktop:
#   scp scripts/pi/*.sh scripts/pi/app-role-limits.sql <ssh-user>@<pi>:docker/postgres/ && ssh <ssh-user>@<pi> sh docker/postgres/install-backups.sh
# Safe to run again. It never writes secrets: telegram.env and backup-age.pub are yours to add.
set -eu
cd "$HOME/docker/postgres"

command -v age >/dev/null || sudo apt-get install -y age

# Nightly: send the dump off-site once the Telegram settings exist
if ! grep -q backup-offsite backup.sh; then
    cat >> backup.sh <<'EOF'
if [ -r telegram.env ] && [ -r backup-age.pub ]; then sh ./backup-offsite.sh "$BACKUP_DIR/scrumspecter-$STAMP.dump"; fi
EOF
fi

# Hourly disk check, also only once Telegram is set up
if ! crontab -l 2>/dev/null | grep -q disk-alert.sh; then
    (crontab -l 2>/dev/null; echo "0 * * * * [ -r $HOME/docker/postgres/telegram.env ] && sh $HOME/docker/postgres/disk-alert.sh # scrumspecter disk alert") | crontab -
fi

# Caps on the app's database role
docker exec -i scrumspecter-postgres psql -U scrumspecter -q < app-role-limits.sql
docker exec scrumspecter-postgres psql -U scrumspecter -Atc "select rolconnlimit, rolconfig from pg_roles where rolname = 'scrumspecter_app'"

echo "Done. Still needed: telegram.env (token + chat id) and backup-age.pub (age public key)."
