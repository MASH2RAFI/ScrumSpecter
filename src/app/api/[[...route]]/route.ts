import { Hono } from "hono";
import { handle } from "hono/vercel";
import { HTTPException } from "hono/http-exception";
import { sql } from "drizzle-orm";
import { getCookie } from "hono/cookie";
import { z } from "zod";

import { db } from "@/lib/db";
import { AUTH_COOKIE } from "@/features/auth/constants";
import { isBatchablePath, MAX_BATCH } from "@/lib/batch";

import account from "@/features/account/server/route";
import auth from "@/features/auth/server/route";
import members from "@/features/members/server/route";
import notifications from "@/features/notifications/server/route";
import workspaces from "@/features/workspaces/server/route";
import projects from "@/features/projects/server/route";
import tasks from "@/features/tasks/server/route";
import routines from "@/features/routines/server/route";
import cron from "@/features/cron/route";
import changeRequests from "@/features/change-requests/server/route";
import stars from "@/features/stars/server/route";
import exportRoutes from "@/features/export/server/route";

const app = new Hono().basePath("/api");

app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: "Something went wrong" }, 500);
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

// For an outside uptime monitor: no auth, never cached, no details beyond up or down
app.get("/health", async (c) => {
    c.header("Cache-Control", "no-store");
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            db.execute(sql`select 1`),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), 3_000); }),
        ]);
        return c.json({ ok: true, db: "up", latencyMs: Date.now() - started });
    } catch {
        return c.json({ ok: false, db: "down" }, 503);
    } finally {
        clearTimeout(timer);
    }
});

// Several GET requests in one round trip: a page load asks for a dozen things at once, and each
// separate request pays for its own trip to the browser and its own checks. Every request runs
// through the app exactly as if it had arrived alone (same session cookie, same checks, same
// limits); only GETs of the JSON endpoints in lib/batch.ts are allowed, so this opens nothing new.
const batchSchema = z.object({ requests: z.array(z.string().max(8000)).min(1).max(MAX_BATCH) });
// The few request headers a handler reads (the session, and the device behind a sign-in)
const BATCH_CONCURRENCY = 4;
const FORWARDED_HEADERS = ["cookie", "user-agent", "accept-language", "x-real-ip", "x-forwarded-for", "x-vercel-ip-city", "x-vercel-ip-country"];

app.post("/batch", async (c) => {
    c.header("Cache-Control", "no-store");
    if (!getCookie(c, AUTH_COOKIE)) return c.json({ error: "Unauthorized" }, 401);
    const parsed = batchSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Invalid batch" }, 400);

    const origin = new URL(c.req.url).origin;
    const headers = new Headers();
    for (const name of FORWARDED_HEADERS) {
        const value = c.req.header(name);
        if (value) headers.set(name, value);
    }

    const cookies = new Set<string>();
    const run = async (path: string) => {
        let url: URL;
        try {
            url = new URL(path, origin);
        } catch {
            return { status: 400, type: "application/json", body: JSON.stringify({ error: "Not a batchable request" }) };
        }
        if (url.origin !== origin || !isBatchablePath(url.pathname)) {
            return { status: 400, type: "application/json", body: JSON.stringify({ error: "Not a batchable request" }) };
        }
        const response = await app.request(url, { method: "GET", headers });
        for (const cookie of response.headers.getSetCookie()) cookies.add(cookie);
        return { status: response.status, type: response.headers.get("content-type") ?? "application/json", body: await response.text() };
    };
    // A few at a time, not all at once: each needs a database connection (3 per server copy), and one that
    // waits longer than the pool allows (10 s) fails. A page load's dozen finish well inside that this way.
    const results: Awaited<ReturnType<typeof run>>[] = [];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, parsed.data.requests.length) }, async () => {
        while (next < parsed.data.requests.length) {
            const index = next++;
            results[index] = await run(parsed.data.requests[index]);
        }
    }));

    // A refreshed session cookie from any of them
    for (const cookie of cookies) c.header("Set-Cookie", cookie, { append: true });
    return c.json({ results });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routes = app
    .route("/auth", auth)
    .route("/account", account)
    .route("/workspaces", workspaces)
    .route("/projects", projects)
    .route("/members", members)
    .route("/tasks", tasks)
    .route("/routines", routines)
    .route("/change-requests", changeRequests)
    .route("/stars", stars)
    .route("/notifications", notifications)
    .route("/cron", cron)
    .route("/export", exportRoutes);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;