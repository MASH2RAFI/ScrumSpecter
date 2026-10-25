import { defineConfig } from "@playwright/test";

// End-to-end suite: a fresh in-memory database (e2e/db-server.mjs) and `next dev` on its own port.
// Uses an installed Chromium; set CHROMIUM_PATH if it isn't at /usr/bin/chromium.
const DB_PORT = 55433;
const APP_PORT = 3100;
const baseURL = `http://localhost:${APP_PORT}`;

export default defineConfig({
    testDir: "./e2e",
    // Tests in a file share one workspace and build on each other
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: { timeout: 15_000 },
    reporter: [["list"]],
    use: {
        baseURL,
        launchOptions: {
            executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
            args: ["--no-sandbox"],
        },
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
            command: `npx next dev -p ${APP_PORT}`,
            url: `${baseURL}/sign-in`,
            timeout: 180_000,
            reuseExistingServer: false,
            env: {
                DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`,
                DATABASE_SSL: "false",
                NEXT_PUBLIC_APP_URL: baseURL,
                CRON_SECRET: "e2e-cron-secret",
            },
        },
    ],
});
