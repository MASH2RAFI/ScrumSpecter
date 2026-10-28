import "server-only";

import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, tasks, users, workspaces } from "@/lib/db/schema";
import { isValidTimeZone, zonedTimeToUtc } from "@/lib/time-zone";
import { resolvePreferences } from "@/features/auth/preferences";
import { DEFAULT_DURATION_MINUTES } from "@/features/tasks/task-time";
import { TaskStatus } from "@/features/tasks/types";

const DEFAULT_TIME_ZONE = "Asia/Dhaka";
// Tasks with only a date end when the workspace's working day ends (as for reminders)
export const DEFAULT_DAY_END = "18:00";

const localDate = (instant: Date, timeZone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

// When a task ends: its time block's end, or the end of the working day on its due date, in the
// assignee's time zone
export const taskEnd = (
    task: { dueDate: Date | null; startAt: Date | null; durationMinutes: number | null },
    timeZone: string,
    dayEnd: string = DEFAULT_DAY_END,
) => {
    if (task.startAt) {
        return new Date(task.startAt.getTime() + (task.durationMinutes ?? DEFAULT_DURATION_MINUTES) * 60_000);
    }
    if (!task.dueDate) return null;
    const [year, month, day] = localDate(task.dueDate, timeZone).split("-").map(Number);
    return zonedTimeToUtc(year, month, day, dayEnd, timeZone);
};

// Tasks nobody moved out of To Do before they ended go to Backlog. Returns how many moved.
export const moveOverdueToBacklog = async (now = new Date()) => {
    // Anything due before tomorrow could have ended; the exact end is checked per task
    const candidates = await db
        .select({
            id: tasks.id,
            dueDate: tasks.dueDate,
            startAt: tasks.startAt,
            durationMinutes: tasks.durationMinutes,
            preferences: users.preferences,
            dayEnd: workspaces.workDayEnd,
        })
        .from(tasks)
        .innerJoin(workspaces, eq(workspaces.id, tasks.workspaceId))
        // The first assignee's time zone decides when the day ends
        .leftJoin(members, sql`${members.id} = ${tasks.assigneeIds}[1]`)
        .leftJoin(users, eq(users.id, members.userId))
        .where(and(
            eq(tasks.status, TaskStatus.TODO),
            isNotNull(tasks.dueDate),
            lt(tasks.dueDate, new Date(now.getTime() + 24 * 60 * 60_000)),
        ));

    const ended = candidates
        .filter((task) => {
            const zone = resolvePreferences(task.preferences).timeZone;
            const end = taskEnd(task, isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE, task.dayEnd);
            return end !== null && end.getTime() <= now.getTime();
        })
        .map((task) => task.id);

    if (ended.length === 0) return 0;

    // Re-checks the status, so a task someone started meanwhile stays where it is
    const moved = await db.update(tasks)
        .set({ status: TaskStatus.BACKLOG })
        .where(and(inArray(tasks.id, ended), eq(tasks.status, TaskStatus.TODO)))
        .returning({ id: tasks.id });

    return moved.length;
};
