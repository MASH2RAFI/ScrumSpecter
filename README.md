This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can see the deployed version in [scrumspecter](https://scrumspecter.vercel.app).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [scrumspecter](https://scrumspecter.vercel.app) for more details.

## Database (self-hosted Postgres)

Data and auth live in Postgres on `minipi`. The compose stack is in the `docker/postgres` folder of the `mashrafi` SMB share.

1. On the Pi: `sh ~/docker/postgres/start.sh`. Postgres data lives in an ext4 image on the torrents drive (`/mnt/torrents/scrumspecter-postgres.ext4`, loop-mounted at `/mnt/pgdata` via fstab), and nightly backups go to `/mnt/torrents/scrumspecter-backups`. The script runs `docker compose up -d` and `tailscale funnel --bg --tcp 10000 tcp://localhost:5432`. Funnel has to be allowed for the node in the tailnet ACL.
2. Copy `.env.example` to `.env.local`, then set `DATABASE_URL` using the password from the Pi's `docker/postgres/.env`.
3. `npm run db:migrate` creates the tables (`drizzle/`). After any change to `src/lib/db/schema.ts`, run `npm run db:generate` first.
4. Vercel: set `DATABASE_URL`, `DATABASE_SSL=direct` and `NEXT_PUBLIC_APP_URL`, and remove the `*APPWRITE*` variables. Funnel routes connections by TLS SNI and drops Postgres' plaintext `SSLRequest`, so Vercel connects with direct TLS (`src/lib/db/pool-config.ts`, which needs Postgres 17+).
