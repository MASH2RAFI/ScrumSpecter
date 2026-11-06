#!/bin/sh
# Starts a production build of the app against a database that is "far away", to time first loads.
#   1. Build once:  NEXT_DIST_DIR=.next-bench NEXT_PUBLIC_APP_URL=http://localhost:3200 DATABASE_SSL=false HOLIDAY_FEED=off \
#        NEXT_PUBLIC_VAPID_PUBLIC_KEY=<any public key> npx next build
#   2. sh scripts/perf/up.sh [delay ms each way, default 60 = 120 ms round trip] [pool size, default 3]
#   3. node scripts/local-demo.mjs   (seeds the demo accounts once)
#   4. node scripts/perf/measure.mjs 5 100        a direct visit with a session (runs, browser latency ms)
#      node scripts/perf/login-flow.mjs 4 100 1500   sign in through the form (runs, latency, typing ms)
#      node scripts/perf/js-weight.mjs            the code a direct visit downloads
#   5. sh scripts/perf/down.sh
# PGlite (55500), the delay proxy (55600) and the app (3200); logs in .perf-logs. Never touches a real database.
cd "$(dirname "$0")/../.." || exit 1
DELAY="${1:-60}"; POOL="${2:-3}"
mkdir -p .perf-logs .local-demo
PGLITE_DIR=.local-demo/pgdata E2E_DB_PORT=55500 setsid nohup node e2e/db-server.mjs > .perf-logs/db.log 2>&1 &
until grep -q "database ready" .perf-logs/db.log 2>/dev/null; do sleep 1; done
setsid nohup node scripts/perf/latency-proxy.mjs 55600 55500 "$DELAY" > .perf-logs/proxy.log 2>&1 &
NEXT_DIST_DIR=.next-bench NEXT_PUBLIC_APP_URL=http://localhost:3200 DATABASE_URL="postgres://postgres:postgres@127.0.0.1:55600/postgres" DATABASE_SSL=false DB_POOL_MAX="$POOL" HOLIDAY_FEED=off \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY="BGvkZiIuMHu4m7wGHTsKx4ttkM_chOM-aUelU7Ctcq6gxWHO5zhjYsKyj3xXj0OTKeBAP80f_T9ozqfXE6Mpatc" \
  VAPID_PRIVATE_KEY="rn3cL_UEVi7LbhRzmSYoZv4rs3icP-WQjPzXidw5id0" VAPID_SUBJECT="mailto:bench@example.com" \
  setsid nohup npx next start -p 3200 > .perf-logs/app.log 2>&1 &
until curl -s -o /dev/null http://localhost:3200/sign-in; do sleep 1; done
echo "stack up: delay ${DELAY} ms each way, pool ${POOL}"
