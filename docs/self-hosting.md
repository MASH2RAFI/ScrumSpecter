# Self-hosting ScrumSpecter

How the production database behind [scrumspecter.vercel.app](https://scrumspecter.vercel.app) is run. Back to the [README](../README.md); the environment variables are listed [there](../README.md#-environment).

## Database (self-hosted Postgres)

Data and auth live in Postgres on the Pi. The compose stack is in the `docker/postgres` folder of the `<ssh-user>` SMB share.

The commands below use placeholders:
- `<pi-tailscale-ip>`: the Pi's Tailscale IP, from `tailscale ip -4` on the Pi or the Tailscale admin console (Machines).
- `<ssh-user>`: your login on the Pi (`whoami` on the Pi).
- `<funnel-host>`: the Pi's Funnel hostname (`<machine>.<tailnet>.ts.net`), from `tailscale funnel status` on the Pi. Vercel's `DATABASE_URL` points at `<funnel-host>:10000`.

1. On the Pi: `sh ~/docker/postgres/start.sh`. This runs `docker compose up -d` and `tailscale funnel --bg --tcp 10000 tcp://localhost:5432`. Funnel has to be allowed for the node in the tailnet ACL.
2. Everything ScrumSpecter keeps on the torrents drive is in `/mnt/torrents/scrumspecter/`:
   - the Postgres data, an ext4 image (`postgres.ext4`, loop-mounted at `/mnt/pgdata` via fstab);
   - nightly backups in `backups/` (`backup.sh`, 03:00, kept 14 days).
3. **Users:** the app connects as `scrumspecter_app`. Its password is in the Pi's `docker/postgres/app-password`.
   - That user owns only the `scrumspecter` database and isn't a superuser, so it can't read files or run programs on the server.
   - `pg_hba.conf` (in the Pi's `docker/postgres/config/`) allows only this user over TCP, only to the `scrumspecter` database, and only with TLS and a password. Edit that file, then copy it into the container and reload (`select pg_reload_conf()`), or restart the container.
   - The `scrumspecter` superuser only works inside the container: `docker exec scrumspecter-postgres psql -U scrumspecter`.
4. **Migrations:** after any change to `src/lib/db/schema.ts`, run `npm run db:generate` to write a migration into `drizzle/`. To apply migrations on the Pi:
   1. Open a tunnel: `ssh -f -N -L 15432:127.0.0.1:5432 <ssh-user>@<pi-tailscale-ip>`. The migration tool can't connect through Funnel, which needs TLS from the first byte.
   2. Run as the app user, so anything new is owned by it: `DATABASE_URL="postgres://scrumspecter_app:<password>@127.0.0.1:15432/scrumspecter" npx drizzle-kit migrate`.
   3. Close the tunnel.

   With Tailscale SSH (which asks for a browser check at each new connection), open one master connection first, `ssh -o ControlMaster=yes -o ControlPath=/tmp/pi-%C -o ControlPersist=30m -fN <ssh-user>@<pi-tailscale-ip>`, approve the check once, then forward the port through it (`ssh -o ControlPath=/tmp/pi-%C -O forward -L 15432:127.0.0.1:5432 <ssh-user>@<pi-tailscale-ip>`) and close it with `-O cancel`. Read the app password on the Pi into a shell variable instead of typing it, so it never shows in a log. Check afterwards that the new objects exist and are owned by `scrumspecter_app`, and that `/api/health` still answers.

   Back up first (`sh ~/docker/postgres/backup.sh`). **Order matters:** a migration that adds a column or table the new code reads (like `0019_task_done_at`, the finished-at column) must be applied *before* the code is pushed, or every query that touches it fails until it is. A migration the old code simply ignores can go either way (like `0020_tasks_open_due_idx`, an index for the reminder scan); deploy the matching code soon after. The app role has a 15-second statement limit (`scripts/pi/app-role-limits.sql`): a migration that rewrites a very large table is better run as the superuser inside the container.
5. **Vercel:** set the variables above (`DATABASE_SSL=direct`). Funnel routes connections by TLS SNI and drops Postgres's plaintext `SSLRequest`, so Vercel connects with direct TLS (`src/lib/db/pool-config.ts`, which needs Postgres 17+).

## Reminders job

Vercel's free cron runs once a day (`/api/cron/routines`: it tops up routine tasks, and removes expired sessions, old sign-in counters, notifications older than 90 days and used or expired tokens), so the Pi calls `GET /api/cron/reminders` every 5 minutes. Each call sends due reminders, then moves tasks still in To Do after they ended to Backlog.

- **Crontab** (`crontab -l` on the Pi): `*/5 * * * * sh /home/<ssh-user>/docker/postgres/reminders.sh`, next to the 03:00 backup line.
- **Script:** `~/docker/postgres/reminders.sh` calls `https://scrumspecter.vercel.app/api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`.
- **Secret:** read from `~/docker/postgres/cron-secret` (owner-only). It must match `CRON_SECRET` on Vercel.
- **Log:** only failures are written, to `~/docker/postgres/reminders.log`, which keeps the last 200 lines. An empty or missing log means every run worked.

## Backups and restore
`backup.sh` writes a full `pg_dump` every night at 03:00 to `backups/` and keeps 14. Those copies sit on the same disk as the database, so a dump also goes off the Pi, **encrypted**, to a private Telegram channel every 15 days (set `TELEGRAM_BACKUP_EVERY_DAYS=30` in `telegram.env` for monthly; `FORCE=1 sh backup-offsite.sh <dump>` uploads at once). The script runs every night and uploads only when the last complete upload is old enough, retrying each night until one succeeds. Between uploads the newest copy off the Pi is up to that many days old, so changes made since then exist only on the Pi's own disk. The scripts are in this repo under `scripts/pi/`; copy them to `~/docker/postgres/` on the Pi.

One-time setup. `scripts/pi/install-backups.sh` does the parts that need no secrets (installs `age`, hooks `backup.sh`, adds the hourly disk check to cron, applies the database limits); run it from the repo with
`scp scripts/pi/*.sh scripts/pi/app-role-limits.sql <ssh-user>@<pi-tailscale-ip>:docker/postgres/ && ssh <ssh-user>@<pi-tailscale-ip> sh docker/postgres/install-backups.sh`. Then:
1. **Bot and channel:** create a bot with @BotFather, make a private channel only you are in, and add the bot as an admin that can post. Put the token and the channel id in `~/docker/postgres/telegram.env` (`chmod 600`):
   ```
   TELEGRAM_BOT_TOKEN=<bot token>
   TELEGRAM_CHAT_ID=<channel id, starts with -100>
   ```
   Never commit this file or paste its values anywhere.
2. **Encryption key:** on your own computer, `age-keygen -o scrumspecter-backup.key`. Keep that file (the private key) in your password manager, not on the Pi. Copy only the public key line (`age1…`) to `~/docker/postgres/backup-age.pub` on the Pi. Install `age` on the Pi (`sudo apt install age`).
3. **Nightly hook:** added to `backup.sh` by the install script; it runs only once `telegram.env` and `backup-age.pub` exist.

What it does: encrypts the dump with `age`, splits it into 19 MB parts (the Bot API downloads at most 20 MB per file), posts each part with a caption (`scrumspecter · <date> · <size> · sha256 <hash> · part n/N`), and logs date, part, hash and `file_id` to `telegram-backups.log`, because a bot can't list old messages. The log lines of a night are written only after every part has uploaded, so a failed upload leaves nothing in the log for the restore test to mistake for the latest backup (copy the updated `backup-offsite.sh` to the Pi to get this). Any failure sends "❌ backup failed: <step>"; a successful upload sends "✅ backup uploaded", and every Sunday it sends a "✅ still running, last Telegram backup <date>" line, so a silent bot still means the job is alive. `sh scripts/pi/test-backup-offsite.sh` checks the schedule with a fake Telegram.

**Restore test (monthly):** copy the private key to the Pi for the test only, then:
```
sh ~/docker/postgres/restore-test.sh /path/to/scrumspecter-backup.key            # latest backup
sh ~/docker/postgres/restore-test.sh /path/to/scrumspecter-backup.key 2026-11-01 # a given day
shred -u /path/to/scrumspecter-backup.key
```
It downloads that day's parts, checks the hash, decrypts, restores into a throwaway `postgres:17` container, prints row counts for users, workspaces and tasks, and removes the container. The live database isn't touched.

Limits to know: the channel grows forever (bots can't delete their messages after 48 hours; a few MB a night is fine), and Telegram isn't a storage service, so the 14 local dumps stay the first copy.

## Fresh start (empty the database)

Deletes every user, workspace, task and session; everyone signs up again. The tables, roles and migration history stay, so nothing needs re-migrating.
1. Back up first: `sh ~/docker/postgres/backup.sh` (a local dump plus the encrypted Telegram copy).
2. Empty every app table in one transaction, as the superuser inside the container:
   ```
   docker exec -i scrumspecter-postgres psql -U scrumspecter -d scrumspecter -v ON_ERROR_STOP=1 <<'SQL'
   BEGIN;
   DO $$ DECLARE stmt text; BEGIN
     SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE'
       INTO stmt FROM pg_tables WHERE schemaname = 'public';
     EXECUTE stmt;
   END $$;
   COMMIT;
   SQL
   ```
   Migration history lives in the `drizzle` schema, which this leaves alone.
3. Apply any pending migrations as usual (Database, step 4).
4. Optional: delete older dumps in `backups/`. Keep `telegram-backups.log`: restoring a Telegram backup needs it. Sessions cached by a running server end within 30 seconds.

## Monitoring
- **Uptime:** `.github/workflows/uptime.yml` calls `/api/health` every 15 minutes from GitHub. The endpoint answers 200 with `{"ok":true,"db":"up"}`, or 503 when the database can't be reached in 3 seconds. A failing run emails the repo owner.
- **Disk space:** `scripts/pi/disk-alert.sh` posts to the Telegram channel when `/mnt/pgdata` or `/mnt/torrents` is over 80% full (once a day per disk). Crontab: `0 * * * * sh /home/<ssh-user>/docker/postgres/disk-alert.sh`.
- **Database limits for the app role:** run `scripts/pi/app-role-limits.sql` once (instructions inside): at most 80 connections (enough for 13 server copies of 6, the default `DB_POOL_MAX`; Vercel does not cap the number of copies, so apply this before deploying a version that keeps 6 per copy, and count the copies it really runs before raising either number), a 15-second statement timeout, and a 60-second limit on idle open transactions. The app also keeps at most 6 connections per server copy and gives up connecting after 10 seconds.
