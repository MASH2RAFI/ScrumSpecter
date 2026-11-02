import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { routines, stars, tasks } from "@/lib/db/schema";
import { idString } from "@/lib/limits";
import { sessionMiddleware } from "@/lib/session-middleware";
import { requireMember } from "@/features/members/utils";

const itemSchema = z.union([
    z.object({ taskId: idString }).strict(),
    z.object({ routineId: idString }).strict(),
]);

const app = new Hono()
    // For the star buttons on one workspace's pages
    .get("/ids", sessionMiddleware, zValidator("query", z.object({ workspaceId: idString })), async (c) => {
        const { workspaceId } = c.req.valid("query");
        // Together: the stars are the caller's own, so reading them before the member check shows nothing
        const [member, rows] = await Promise.all([
            requireMember(c, workspaceId),
            db.select({ taskId: stars.taskId, routineId: stars.routineId }).from(stars)
                .where(and(eq(stars.userId, c.get("user").$id), eq(stars.workspaceId, workspaceId))),
        ]);
        if (member instanceof Response) return member;
        return c.json({
            data: {
                taskIds: rows.flatMap((row) => row.taskId ?? []),
                routineIds: rows.flatMap((row) => row.routineId ?? []),
            },
        });
    })

    .post("/", sessionMiddleware, zValidator("json", itemSchema), async (c) => {
        const item = c.req.valid("json");
        const [found] = "taskId" in item
            ? await db.select({ workspaceId: tasks.workspaceId }).from(tasks).where(eq(tasks.id, item.taskId)).limit(1)
            : await db.select({ workspaceId: routines.workspaceId }).from(routines).where(eq(routines.id, item.routineId)).limit(1);
        // Same answer for a missing item and someone else's, so ids can't be probed
        if (!found) return c.json({ error: "Unauthorized" }, 401);
        const member = await requireMember(c, found.workspaceId);
        if (member instanceof Response) return member;

        await db.insert(stars).values({ userId: c.get("user").$id, workspaceId: found.workspaceId, ...item }).onConflictDoNothing();
        return c.json({ success: true });
    })

    // Only ever touches the person's own stars, so no membership check is needed
    .delete("/", sessionMiddleware, zValidator("json", itemSchema), async (c) => {
        const item = c.req.valid("json");
        await db.delete(stars).where(and(
            eq(stars.userId, c.get("user").$id),
            "taskId" in item ? eq(stars.taskId, item.taskId) : eq(stars.routineId, item.routineId),
        ));
        return c.json({ success: true });
    });

export default app;
