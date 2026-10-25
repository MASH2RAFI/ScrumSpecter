import "server-only";

import { and, eq, gte, inArray, max, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { projects, routines, tasks } from "@/lib/db/schema";
import { TaskStatus } from "@/features/tasks/types";
import { isValidTimeZone, zonedTimeToUtc } from "@/lib/time-zone";

type RoutineTime = { startTime: string | null; timeZone: string | null; durationMinutes: number | null };

// The routine's time on a routine day (dueDate is that day at 12:00 UTC); null for all-day routines
export const routineStartAt = ({ startTime, timeZone }: RoutineTime, dueDate: Date) =>
    startTime
        ? zonedTimeToUtc(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, dueDate.getUTCDate(), startTime, timeZone && isValidTimeZone(timeZone) ? timeZone : "UTC")
        : null;

// Used when a project has no sprint end date
export const ROUTINE_HORIZON_DAYS = 7;
// Safety cap for very long sprints
const MAX_HORIZON_DAYS = 366;

const DAY_MS = 86_400_000;

const startOfUtcDay = (date: Date) => Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

// Days from today through the sprint's last day (inclusive); 0 once the sprint has ended
export const daysUntilSprintEnd = (sprintEnd: string | null | undefined, from = new Date()) => {
    const match = sprintEnd?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
        return ROUTINE_HORIZON_DAYS;
    }
    const end = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const days = Math.round((end - startOfUtcDay(from)) / DAY_MS) + 1;
    return Math.min(Math.max(days, 0), MAX_HORIZON_DAYS);
};

// Due at 12:00 UTC, so the calendar date reads the same from UTC-11 to UTC+11
export const routineDueDates = (weekdays: number[], from = new Date(), days = ROUTINE_HORIZON_DAYS) => {
    const today = startOfUtcDay(from);
    const wanted = new Set(weekdays);

    return Array.from({ length: days }, (_, i) => new Date(today + i * DAY_MS + DAY_MS / 2))
        // getUTCDay: 0 = Sunday; routines store ISO weekdays (7 = Sunday)
        .filter((date) => wanted.has(date.getUTCDay() || 7));
};

// Creates any missing tasks for active routines through the end of each project's current
// sprint (a week ahead when the project has no sprint end). Safe to run repeatedly:
// the (routine_id, due_date) unique index turns repeats into no-ops.
export const generateRoutineTasks = async (filter?: SQL) => {
    const active = await db
        .select({ routine: routines, sprintEnd: projects.currentSprintEndDate })
        .from(routines)
        .innerJoin(projects, eq(projects.id, routines.projectId))
        .where(and(eq(routines.active, true), filter))
        .then((rows) => rows.map(({ routine, sprintEnd }) => ({ ...routine, sprintEnd })));

    if (active.length === 0) {
        return 0;
    }

    const projectIds = Array.from(new Set(active.map((routine) => routine.projectId)));
    const positions = await db
        .select({ projectId: tasks.projectId, position: max(tasks.position) })
        .from(tasks)
        .where(and(inArray(tasks.projectId, projectIds), eq(tasks.status, TaskStatus.TODO)))
        .groupBy(tasks.projectId);
    const nextPosition = new Map(positions.map((row) => [row.projectId, (row.position ?? 0) + 1000]));

    const rows = active.flatMap((routine) =>
        routineDueDates(routine.weekdays, new Date(), daysUntilSprintEnd(routine.sprintEnd)).map((dueDate) => {
            const position = nextPosition.get(routine.projectId) ?? 1000;
            nextPosition.set(routine.projectId, position + 1000);
            return {
                name: routine.name,
                description: routine.description,
                status: TaskStatus.TODO,
                workspaceId: routine.workspaceId,
                projectId: routine.projectId,
                assigneeId: routine.assigneeId,
                storyPoints: routine.storyPoints,
                position,
                dueDate,
                startAt: routineStartAt(routine, dueDate),
                durationMinutes: routine.startTime ? routine.durationMinutes : null,
                routineId: routine.id,
            };
        })
    );

    if (rows.length === 0) {
        return 0;
    }

    const created = await db
        .insert(tasks)
        .values(rows)
        .onConflictDoNothing({ target: [tasks.routineId, tasks.dueDate] })
        .returning({ id: tasks.id });

    return created.length;
};

// After a routine's time changes, move its upcoming not-started tasks to the new time
export const retimeUpcomingRoutineTasks = async (routineId: string, time: RoutineTime) => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
    const upcoming = await db
        .select({ id: tasks.id, dueDate: tasks.dueDate })
        .from(tasks)
        .where(and(eq(tasks.routineId, routineId), eq(tasks.status, TaskStatus.TODO), gte(tasks.dueDate, today)));

    await Promise.all(upcoming.map((task) =>
        db.update(tasks)
            .set({
                startAt: task.dueDate ? routineStartAt(time, task.dueDate) : null,
                durationMinutes: time.startTime ? time.durationMinutes : null,
            })
            .where(eq(tasks.id, task.id))
    ));
};
