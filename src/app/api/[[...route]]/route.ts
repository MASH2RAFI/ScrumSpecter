import { Hono } from "hono";
import { handle } from "hono/vercel";
import { HTTPException } from "hono/http-exception";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

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