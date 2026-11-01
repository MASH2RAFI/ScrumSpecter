import "server-only";

import { count, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import { db } from "@/lib/db";
import { projects, routines, tasks, workspaces } from "@/lib/db/schema";

// Most a single account or workspace may hold, so one person can't fill the Pi's disk.
// Routine tasks are made by the server and not counted against "tasks" when generated.
export const VOLUME_CAPS = {
    workspaces: 20, // created per account
    projects: 100, // per workspace
    routines: 100, // per workspace
    tasks: 20_000, // per workspace
} as const;

type Kind = keyof typeof VOLUME_CAPS;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const COUNTED = {
    workspaces: { table: workspaces, scope: workspaces.userId, where: "your account" },
    projects: { table: projects, scope: projects.workspaceId, where: "a workspace" },
    routines: { table: routines, scope: routines.workspaceId, where: "a workspace" },
    tasks: { table: tasks, scope: tasks.workspaceId, where: "a workspace" },
} as const;

// Throws a 409 with a clear message when adding `adding` more would pass the cap; inside a
// transaction it also rolls that back.
// shortcut: count-then-insert, so two requests at the same moment can pass the cap by a few; fine for a disk guard
export const assertRoom = async (kind: Kind, scopeId: string, adding = 1, tx: Tx | typeof db = db) => {
    if (adding <= 0) return;
    const { table, scope, where } = COUNTED[kind];
    const [{ value }] = await tx.select({ value: count() }).from(table).where(eq(scope, scopeId));
    const cap = VOLUME_CAPS[kind];
    if (value + adding > cap) {
        const error = `Limit reached: ${where} can have at most ${cap.toLocaleString("en-US")} ${kind} (it has ${value.toLocaleString("en-US")}).`;
        throw new HTTPException(409, { res: Response.json({ error }, { status: 409 }) });
    }
};
