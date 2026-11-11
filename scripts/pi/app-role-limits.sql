-- Caps on the app's database role, so the live site can't exhaust the Pi (TODO §4).
-- Run once as the superuser inside the container:
--   docker exec -i scrumspecter-postgres psql -U scrumspecter < app-role-limits.sql
-- New connections pick these up; existing ones keep the old values until they reconnect.

-- Each Vercel server copy keeps up to DB_POOL_MAX connections (6 by default: src/lib/db/index.ts); this caps all of them together and leaves room for the superuser
-- and migrations. 80 serves 13 copies at 6 each; Postgres allows 100, and a connection costs ~10 MB.
ALTER ROLE scrumspecter_app CONNECTION LIMIT 80;

-- No single query may run longer than this (the app also sets 15 s per connection)
ALTER ROLE scrumspecter_app SET statement_timeout = '15s';

-- A transaction left open by a crashed request releases its locks and connection
ALTER ROLE scrumspecter_app SET idle_in_transaction_session_timeout = '60s';

-- Check:
-- SELECT rolname, rolconnlimit, rolconfig FROM pg_roles WHERE rolname = 'scrumspecter_app';
