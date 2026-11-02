import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, asc, eq, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, projects, routines, stars, tasks, workspaces } from "@/lib/db/schema";
import { idString } from "@/lib/limits";
import { sessionMiddleware } from "@/lib/session-middleware";
import { requireMember } from "@/features/members/utils";
import { TaskStatus } from "@/features/tasks/types";

const itemSchema = z.union([
    z.object({ taskId: idString }).strict(),
    z.object({ routineId: idString }).strict(),
]);

// Only workspaces the person is still in (leaving also deletes the stars, see drizzle/0013_stars.sql)
const stillMember = (userId: string) =>
    and(eq(members.workspaceId, stars.workspaceId), eq(members.userId, userId));

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

    // The Starred page: every workspace at once
    .get("/", sessionMiddleware, zValidator("query", z.object({ includeDone: z.enum(["true", "false"]).optional() })), async (c) => {
        const userId = c.get("user").$id;
        const includeDone = c.req.valid("query").includeDone === "true";

        const [taskRows, routineRows] = await Promise.all([
            db.select({
                id: tasks.id,
                name: tasks.name,
                status: tasks.status,
                dueDate: tasks.dueDate,
                workspaceId: tasks.workspaceId,
                workspaceName: workspaces.name,
                projectId: tasks.projectId,
                projectName: projects.name,
                assigneeNames: sql<string[]>`array(select coalesce(u.name, m.placeholder_name) from members m
                    left join users u on u.id = m.user_id where m.id = any(${tasks.assigneeIds}))`,
            })
                .from(stars)
                .innerJoin(members, stillMember(userId))
                .innerJoin(tasks, eq(tasks.id, stars.taskId))
                .innerJoin(workspaces, eq(workspaces.id, tasks.workspaceId))
                .leftJoin(projects, eq(projects.id, tasks.projectId))
                .where(and(eq(stars.userId, userId), includeDone ? undefined : ne(tasks.status, TaskStatus.DONE)))
                .orderBy(asc(workspaces.name), asc(tasks.dueDate), asc(tasks.name)),
            db.select({
                id: routines.id,
                name: routines.name,
                weekdays: routines.weekdays,
                startTime: routines.startTime,
                active: routines.active,
                workspaceId: routines.workspaceId,
                workspaceName: workspaces.name,
                projectId: routines.projectId,
                projectName: projects.name,
                // Its next generated task that isn't done
                nextDue: sql<string | null>`(select min(t.due_date) from tasks t where t.routine_id = ${routines.id}
                    and t.status <> 'DONE' and t.due_date >= date_trunc('day', now()))`,
            })
                .from(stars)
                .innerJoin(members, stillMember(userId))
                .innerJoin(routines, eq(routines.id, stars.routineId))
                .innerJoin(workspaces, eq(workspaces.id, routines.workspaceId))
                .leftJoin(projects, eq(projects.id, routines.projectId))
                .where(eq(stars.userId, userId))
                .orderBy(asc(workspaces.name), asc(routines.name)),
        ]);

        return c.json({
            data: {
                tasks: taskRows.map((task) => ({ ...task, dueDate: task.dueDate?.toISOString() ?? null })),
                routines: routineRows.map((routine) => ({ ...routine, nextDue: routine.nextDue ? new Date(routine.nextDue).toISOString() : null })),
            },
        });
    })

    // Starring twice is harmless; any member may star, Viewers included
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
