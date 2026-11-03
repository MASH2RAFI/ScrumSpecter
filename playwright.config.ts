import { defineConfig } from "@playwright/test";

// End-to-end suite: a fresh in-memory database (e2e/db-server.mjs) and `next dev` on its own port.
// Uses an installed Chromium; set CHROMIUM_PATH if it isn't at /usr/bin/chromium. E2E_BROWSER=firefox
// or webkit runs it in Playwright's own build of that browser (WebKit: scripts/e2e-webkit.sh).
const browserName = (process.env.E2E_BROWSER ?? "chromium") as "chromium" | "firefox" | "webkit";
// E2E_PROD=1: against a production build in .next-build (scripts/test-all.sh builds it), since timing
// and library behaviour differ there; three development-only tests skip themselves
const production = Boolean(process.env.E2E_PROD);
const DB_PORT = 55433;
const APP_PORT = 3100;
const baseURL = `http://localhost:${APP_PORT}`;

export default defineConfig({
    testDir: "./e2e",
    // Tests in a file share one workspace and build on each other
    fullyParallel: false,
    workers: 1,
    // Generous: `next dev` compiles each page on its first visit
    timeout: 120_000,
    expect: { timeout: 15_000 },
    reporter: [["list"]],
    use: {
        baseURL,
        browserName,
        launchOptions: browserName === "chromium"
            ? { executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] }
            : {},
        trace: "retain-on-failure",
    },
    webServer: [
        {
            command: "node e2e/db-server.mjs",
            port: DB_PORT,
            env: { E2E_DB_PORT: String(DB_PORT) },
            reuseExistingServer: false,
        },
        {
            command: production ? `npx next start -p ${APP_PORT}` : `npx next dev -p ${APP_PORT}`,
            url: `${baseURL}/sign-in`,
            timeout: 180_000,
            reuseExistingServer: false,
            env: {
                DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
                DATABASE_SSL: "false",
                // PGlite has one session; a single connection keeps queries from interleaving
                DB_POOL_MAX: "1",
                NEXT_PUBLIC_APP_URL: baseURL,
                CRON_SECRET: "e2e-cron-secret",
                // Known to qol-api.spec.ts, which signs a pending Google link like the server does
                AUTH_LINK_SECRET: "e2e-link-secret",
                // Bundled holiday data, so tests don't depend on Google's live feed
                HOLIDAY_FEED: "off",
                // Its own build folder, so a running `npm run dev` isn't disturbed
                NEXT_DIST_DIR: production ? ".next-build" : ".next-e2e",
                // Trust the fake push service in notifications-api.spec.ts (test-only certificate)
                NODE_EXTRA_CA_CERTS: "e2e/fixtures/push-server.crt",
                // A test-only VAPID pair (not the live one), so push tests don't depend on .env.local
                // and pass in CI. Generated with web-push's generateVAPIDKeys().
                NEXT_PUBLIC_VAPID_PUBLIC_KEY: "BGvkZiIuMHu4m7wGHTsKx4ttkM_chOM-aUelU7Ctcq6gxWHO5zhjYsKyj3xXj0OTKeBAP80f_T9ozqfXE6Mpatc",
                VAPID_PRIVATE_KEY: "rn3cL_UEVi7LbhRzmSYoZv4rs3icP-WQjPzXidw5id0",
                VAPID_SUBJECT: "mailto:e2e@example.com",
            },
        },
    ],
});
