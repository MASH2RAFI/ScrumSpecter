# Self-hosting ScrumSpecter

How the production database behind [scrumspecter.vercel.app](https://scrumspecter.vercel.app) is run. Back to the [README](../README.md); the environment variables are listed [there](../README.md#-environment).

## Database (self-hosted Postgres)

Data and auth live in Postgres on `minipi`. The compose stack is in the `docker/postgres` folder of the `mashrafi` SMB share.

1. On the Pi: `sh ~/docker/postgres/start.sh`. This runs `docker compose up -d` and `tailscale funnel --bg --tcp 10000 tcp://localhost:5432`. Funnel has to be allowed for the node in the tailnet ACL.
2. Everything ScrumSpecter keeps on the torrents drive is in `/mnt/torrents/scrumspecter/`:
   - the Postgres data, an ext4 image (`postgres.ext4`, loop-mounted at `/mnt/pgdata` via fstab);
   - nightly backups in `backups/` (`backup.sh`, 03:00, kept 14 days).
3. **Users:** the app connects as `scrumspecter_app`. Its password is in the Pi's `docker/postgres/app-password`.
   - That user owns only the `scrumspecter` database and isn't a superuser, so it can't read files or run programs on the server.
   - `pg_hba.conf` (in the Pi's `docker/postgres/config/`) allows only this user over TCP, only to the `scrumspecter` database, and only with TLS and a password. Edit that file, then copy it into the container and reload (`select pg_reload_conf()`), or restart the container.
   - The `scrumspecter` superuser only works inside the container: `docker exec scrumspecter-postgres psql -U scrumspecter`.
4. **Migrations:** after any change to `src/lib/db/schema.ts`, run `npm run db:generate` to write a migration into `drizzle/`. To apply migrations on the Pi:
   1. Open a tunnel: `ssh -f -N -L 15432:127.0.0.1:5432 mashrafi@100.85.55.98`. The migration tool can't connect through Funnel, which needs TLS from the first byte.
   2. Run as the app user, so anything new is owned by it: `DATABASE_URL="postgres://scrumspecter_app:<password>@127.0.0.1:15432/scrumspecter" npx drizzle-kit migrate`.
   3. Close the tunnel.

   Deploy the matching code right after, because the live site expects the database to match it.
5. **Vercel:** set the variables above (`DATABASE_SSL=direct`). Funnel routes connections by TLS SNI and drops Postgres's plaintext `SSLRequest`, so Vercel connects with direct TLS (`src/lib/db/pool-config.ts`, which needs Postgres 17+).

## Reminders job

Vercel's free cron runs only once a day, so the Pi calls `GET /api/cron/reminders` every 5 minutes. Each call sends due reminders, then moves tasks still in To Do after they ended to Backlog.

- **Crontab** (`crontab -l` on the Pi): `*/5 * * * * sh /home/mashrafi/docker/postgres/reminders.sh`, next to the 03:00 backup line.
- **Script:** `~/docker/postgres/reminders.sh` calls `https://scrumspecter.vercel.app/api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`.
- **Secret:** read from `~/docker/postgres/cron-secret` (owner-only). It must match `CRON_SECRET` on Vercel.
- **Log:** only failures are written, to `~/docker/postgres/reminders.log`, which keeps the last 200 lines. An empty or missing log means every run worked.
