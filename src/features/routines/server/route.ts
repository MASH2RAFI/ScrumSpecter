import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { routines } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { findForeignReference } from "@/lib/db/workspace-refs";
import { generateRoutineTasks, retimeUpcomingRoutineTasks } from "@/lib/routines";
import { isValidTimeZone } from "@/lib/time-zone";
import { requireAdmin, requireMember } from "@/features/members/utils";
import { createRoutineSchema, updateRoutineSchema } from "../schemas";
import { Routine } from "../types";

const ADMINS_ONLY = "Only admins can manage routines";

const toRoutine = (routine: typeof routines.$inferSelect) => toDoc(routine) as Routine;

// Days are stored sorted and unique so the list reads Mon..Sun
const normalizeWeekdays = (weekdays: number[]) => Array.from(new Set(weekdays)).sort((a, b) => a - b);

const INVALID_TIME_ZONE = "Unknown time zone";

const app = new Hono()
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string() })),
        async (c) => {
            const { workspaceId } = c.req.valid("query");

            // Rows are only returned once membership is confirmed
            const [member, rows] = await Promise.all([
                requireMember(c, workspaceId),
                db.select().from(routines).where(eq(routines.workspaceId, workspaceId)).orderBy(asc(routines.createdAt)),
            ]);

            if (member instanceof Response) {
                return member;
            }

            return c.json({ data: { documents: rows.map(toRoutine), total: rows.length } });
        }
    )

    .post(
        "/",
        sessionMiddleware,
        zValidator("json", createRoutineSchema),
        async (c) => {
            const { workspaceId, weekdays, ...fields } = c.req.valid("json");

            if (fields.timeZone && !isValidTimeZone(fields.timeZone)) {
                return c.json({ error: INVALID_TIME_ZONE }, 400);
            }

            const member = await requireAdmin(c, workspaceId, ADMINS_ONLY);
            if (member instanceof Response) {
                return member;
            }

            const foreignReference = await findForeignReference(workspaceId, fields);
            if (foreignReference) {
                return c.json({ error: foreignReference }, 400);
            }

            const [routine] = await db
                .insert(routines)
                .values({ ...fields, workspaceId, weekdays: normalizeWeekdays(weekdays) })
                .returning();

            // Put this week's occurrences on the board right away
            await generateRoutineTasks(eq(routines.id, routine.id));

            return c.json({ data: toRoutine(routine) });
        }
    )

    .patch(
        "/:routineId",
        sessionMiddleware,
        zValidator("json", updateRoutineSchema),
        async (c) => {
            const { routineId } = c.req.param();
            const { weekdays, ...fields } = c.req.valid("json");

            if (fields.timeZone && !isValidTimeZone(fields.timeZone)) {
                return c.json({ error: INVALID_TIME_ZONE }, 400);
            }

            const existing = await findById(routines, routineId);
            if (!existing) {
                return c.json({ error: "Routine not found" }, 404);
            }

            const member = await requireAdmin(c, existing.workspaceId, ADMINS_ONLY);
            if (member instanceof Response) {
                return member;
            }

            const foreignReference = await findForeignReference(existing.workspaceId, fields);
            if (foreignReference) {
                return c.json({ error: foreignReference }, 400);
            }

            const updateData = { ...fields, ...(weekdays ? { weekdays: normalizeWeekdays(weekdays) } : {}) };

            // Drizzle rejects an update with nothing to set
            if (Object.values(updateData).every((value) => value === undefined)) {
                return c.json({ data: toRoutine(existing) });
            }

            // Changes apply to future occurrences; tasks already created stay as they are
            const [routine] = await db
                .update(routines)
                .set(updateData)
                .where(eq(routines.id, routineId))
                .returning();

            // A new time also moves the upcoming tasks it already created
            if (fields.startTime !== undefined || fields.durationMinutes !== undefined || fields.timeZone !== undefined) {
                await retimeUpcomingRoutineTasks(routineId, routine);
            }
            await generateRoutineTasks(eq(routines.id, routineId));

            return c.json({ data: toRoutine(routine) });
        }
    )

    .delete(
        "/:routineId",
        sessionMiddleware,
        async (c) => {
            const { routineId } = c.req.param();

            const existing = await findById(routines, routineId);
            if (!existing) {
                return c.json({ error: "Routine not found" }, 404);
            }

            const member = await requireAdmin(c, existing.workspaceId, ADMINS_ONLY);
            if (member instanceof Response) {
                return member;
            }

            // Tasks it already created are kept (routine_id is set to null)
            await db.delete(routines).where(eq(routines.id, routineId));

            return c.json({ data: { $id: routineId } });
        }
    );

export default app;
