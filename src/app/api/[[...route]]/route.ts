import { Hono } from "hono";
import { handle } from "hono/vercel";

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

const app = new Hono().basePath("/api");

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
    .route("/notifications", notifications)
    .route("/cron", cron);

export const GET = handle(app);
export const POST = handle(app);
export const PATCH = handle(app);
export const DELETE = handle(app);

export type AppType = typeof routes;