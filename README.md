# ScrumSpecter

Sprint planning and task tracking for small agile teams. Live at [scrumspecter.vercel.app](https://scrumspecter.vercel.app).

## Features

- **Workspaces, projects and sprints.** Each project has a sprint (start and end date). Its countdown, story points and progress show on the dashboard.
- **Tasks:**
  - story points, due dates, optional time blocks (start time and duration), descriptions, and up to 20 assignees;
  - five statuses: Backlog, To Do, In Progress, In Review and Done;
  - three views: a table, a kanban board and a calendar, all with drag and drop;
  - bulk edit from the table;
  - Undo after deleting or moving a task.
- **Home ("My work"):** your overdue tasks and those due today and tomorrow, with a countdown to each one's end time.
- **Routines:** tasks that repeat weekly. They're created for each of their weekdays through the end of the sprint, and they skip days off.
- **Roles:**

  | | Admin | Supervisor | Reviewer | Assignee | Viewer |
  |---|:-:|:-:|:-:|:-:|:-:|
  | See everything | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Move own tasks up to In Review | ✓ | ✓ | ✓ | ✓ | |
  | Approve to Done, reopen, any task's status | ✓ | ✓ | ✓ | | |
  | Create, edit and delete tasks, routines and projects; bulk input | ✓ | ✓ | | | |
  | Members, roles, invites, settings, days off | ✓ | | | | |

  Reviewers and Assignees request changes instead (see Change requests below). Placeholders stand in for people who haven't joined yet.
- **Change requests:** Reviewers and Assignees propose new tasks, edits or deletions. Admins and Supervisors approve or decline them on the **Requests** page, and both sides are notified.
- **Invites:**
  - an invite link for Assignees, with an optional expiry (1, 7 or 30 days) and use limit;
  - a separate link for Viewers;
  - links that survive signing in.
- **Days off and working hours:** public holidays come from a country feed, and you can add your own days off. Working hours frame the routines week and decide when unfinished To Do tasks move to Backlog.
- **Notifications:** in-app and push.
  - 6 PM summary of tomorrow's tasks;
  - a reminder 30 minutes before a task ends;
  - change-request decisions.
- **Bulk input** (Settings → Bulk input): add many projects, tasks, routines, days off and placeholders at once, one command per line. Every line is checked before anything is saved, and "Copy AI prompt" lets an AI assistant write the commands.
- **Analytics:** capacity calculator, burndown chart, velocity tracker and a sprint report generator (Markdown).
- **Accounts:**
  - email and password or Google sign-in;
  - forgot-password emails;
  - lockout after repeated failed logins;
  - a list of signed-in devices;
  - preferences: default task view, week start, 12 or 24-hour time, time zone and reminders.
- **Getting around:**
  - a welcome tour on first sign-in (replay it from Ctrl K or the account menu);
  - Ctrl/⌘ K quick jump;
  - keyboard shortcuts (press `?` to see them);
  - dark mode;
  - works on phones and can be installed as an app.

## Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS with shadcn/ui, a [Hono](https://hono.dev) API under `/api` with typed client calls (`src/lib/rpc.ts`), TanStack Query (cached in the browser), and Drizzle ORM with self-hosted PostgreSQL 17. It's hosted on Vercel.

```
src/
  app/               pages: (auth), (dashboard), (standalone); API entry in app/api/[[...route]]
  features/<name>/   api/ (query hooks), components/, server/route.ts (Hono), schemas, types
  lib/               db (schema, pool), auth, routines, reminders, push, email, cron helpers
drizzle/             SQL migrations
e2e/                 Playwright end-to-end tests
```

## Local development

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (see [Environment](#environment)).
3. `npm run db:migrate`
4. `npm run dev`, then open http://localhost:3000.

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run db:generate` | Writes a migration after a change to `src/lib/db/schema.ts` |
| `npm run db:migrate` | Applies migrations to `DATABASE_URL` |
| `npm run test:e2e` | Playwright suite |

### Tests

`npm run test:e2e` starts its own in-memory Postgres (PGlite, `e2e/db-server.mjs`) and its own `next dev` (build folder `.next-e2e`), so it never touches a real database. It covers:
- **the API:** auth, roles, change requests, bulk input and edit, invites, cron jobs;
- **the browser:** sign-up, views, the welcome tour, roles and change requests, phone layouts.

## Environment

| Variable | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (the `scrumspecter_app` user; see below) |
| `DATABASE_SSL` | Vercel | `direct` on Vercel (TLS from the first byte, for Funnel); unset on the tailnet; `false` for a local non-TLS database |
| `NEXT_PUBLIC_APP_URL` | yes | Public base URL, used in invite, reset and push links |
| `CRON_SECRET` | yes | Bearer token for `/api/cron/*` |
| `AUTH_LINK_SECRET` | yes | Signs the pending "link Google to this account" cookie |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional | Google sign-in. Redirect URI: `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | optional | Push notifications (`npx web-push generate-vapid-keys`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | optional | Password-reset emails through [Resend](https://resend.com). Without them the link is written to the server log |
| `HOLIDAY_FEED` | optional | `off` disables the public-holiday feed |

## Scheduled jobs

- `GET /api/cron/routines`: daily via Vercel Cron (`vercel.json`). Keeps routine tasks generated through each sprint's end.
- `GET /api/cron/reminders`: every 5 minutes from the Pi's crontab, because Vercel's free cron runs only daily. It sends due reminders, then moves tasks still in To Do after they ended to Backlog.

Both need `Authorization: Bearer $CRON_SECRET`.

## Database (self-hosted Postgres)

Data and auth live in Postgres on `minipi`. The compose stack is in the `docker/postgres` folder of the `mashrafi` SMB share.

1. On the Pi: `sh ~/docker/postgres/start.sh`. This runs `docker compose up -d` and `tailscale funnel --bg --tcp 10000 tcp://localhost:5432`. Funnel has to be allowed for the node in the tailnet ACL.
2. Everything ScrumSpecter keeps on the torrents drive is in `/mnt/torrents/scrumspecter/`:
   - the Postgres data, an ext4 image (`postgres.ext4`, loop-mounted at `/mnt/pgdata` via fstab);
   - nightly backups in `backups/` (`backup.sh`, 03:00, kept 14 days).
3. **Users:** the app connects as `scrumspecter_app`. Its password is in the Pi's `docker/postgres/app-password`.
   - That user owns only the `scrumspecter` database and isn't a superuser, so it can't read files or run programs on the server.
   - It's the only user allowed in over TCP.
   - The `scrumspecter` superuser only works inside the container: `docker exec scrumspecter-postgres psql -U scrumspecter`.
4. **Migrations:** `npm run db:migrate` applies `drizzle/`. After any change to `src/lib/db/schema.ts`, run `npm run db:generate` first.
5. **Vercel:** set the variables above (`DATABASE_SSL=direct`). Funnel routes connections by TLS SNI and drops Postgres's plaintext `SSLRequest`, so Vercel connects with direct TLS (`src/lib/db/pool-config.ts`, which needs Postgres 17+).
