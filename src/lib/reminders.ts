import "server-only";

import { and, eq, gte, isNotNull, lt, ne, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, notifications, projects, tasks, users, workspaces } from "@/lib/db/schema";
import { pushToUser } from "@/lib/push";
import { isValidTimeZone, zonedTimeToUtc } from "@/lib/time-zone";
import { resolvePreferences } from "@/features/auth/preferences";
import { TaskStatus } from "@/features/tasks/types";
import { taskEnd } from "@/lib/overdue";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// How far back a run looks, so a late or skipped run (the Pi checks every 5 minutes) still
// sends what fell due; the dedupe key keeps anything from going out twice
export const LOOKBACK_MINUTES = 15;
const BEFORE_END_MINUTES = 30;
const SUMMARY_TIME = "18:00";

// YYYY-MM-DD of an instant in a time zone
export const localDate = (instant: Date, timeZone: string) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);

const atLocal = (date: string, time: string, timeZone: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return zonedTimeToUtc(year, month, day, time, timeZone);
};

const previousDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day) - DAY).toISOString().slice(0, 10);
};

const formatTime = (instant: Date, timeZone: string, hour12: boolean) =>
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit", hour12 }).format(instant);

type Reminder = typeof notifications.$inferInsert;

// Finds every reminder due in (now - LOOKBACK, now], records it, and pushes the new ones.
// Safe to run as often as you like: each reminder has a unique dedupe key.
export const runReminders = async (now = new Date()) => {
    const windowStart = now.getTime() - LOOKBACK_MINUTES * MINUTE;
    const due = (at: Date) => at.getTime() > windowStart && at.getTime() <= now.getTime();

    // Unfinished tasks due around now, one row per assignee with an account: a summary looks
    // one day ahead, and a reminder for a task due today can still be pending
    const rows = await db
        .select({
            task: tasks,
            projectName: projects.name,
            userId: users.id,
            preferences: users.preferences,
            dayEnd: workspaces.workDayEnd,
        })
        .from(tasks)
        .innerJoin(workspaces, eq(workspaces.id, tasks.workspaceId))
        .innerJoin(members, sql`${members.id} = any(${tasks.assigneeIds})`)
        .innerJoin(users, eq(users.id, members.userId))
        .leftJoin(projects, eq(projects.id, tasks.projectId))
        .where(and(
            ne(tasks.status, TaskStatus.DONE),
            isNotNull(tasks.dueDate),
            gte(tasks.dueDate, new Date(now.getTime() - 2 * DAY)),
            lt(tasks.dueDate, new Date(now.getTime() + 3 * DAY)),
        ));

    const reminders: Reminder[] = [];
    const summaries = new Map<string, { userId: string; workspaceId: string; date: string; at: Date; names: string[] }>();

    for (const { task, projectName, userId, preferences, dayEnd } of rows) {
        const prefs = resolvePreferences(preferences);
        const timeZone = isValidTimeZone(prefs.timeZone) ? prefs.timeZone : "Asia/Dhaka";
        const hour12 = prefs.timeFormat === "12h";
        const dueDate = localDate(task.dueDate!, timeZone);
        const url = `/workspaces/${task.workspaceId}?task=${task.id}`;

        if (prefs.remindBeforeEnd) {
            const end = taskEnd(task, timeZone, dayEnd)!;
            const at = new Date(end.getTime() - BEFORE_END_MINUTES * MINUTE);
            if (due(at)) {
                reminders.push({
                    userId,
                    workspaceId: task.workspaceId,
                    taskId: task.id,
                    kind: "before_end",
                    title: `Ends in ${BEFORE_END_MINUTES} min: ${task.name}`,
                    body: [projectName, task.startAt
                        ? `${formatTime(task.startAt, timeZone, hour12)} – ${formatTime(end, timeZone, hour12)}`
                        : `Due today by ${formatTime(end, timeZone, hour12)}`].filter(Boolean).join(" · "),
                    url,
                    scheduledFor: at,
                    // A task moved to a new time gets a new reminder
                    dedupeKey: `before_end:${task.id}:${userId}:${end.toISOString()}`,
                });
            }
        }

        if (prefs.remindDayBefore) {
            const at = atLocal(previousDay(dueDate), SUMMARY_TIME, timeZone);
            if (due(at)) {
                const key = `day_before:${userId}:${task.workspaceId}:${dueDate}`;
                const summary = summaries.get(key) ?? { userId, workspaceId: task.workspaceId, date: dueDate, at, names: [] };
                summary.names.push(task.name);
                summaries.set(key, summary);
            }
        }
    }

    for (const [dedupeKey, { userId, workspaceId, at, names }] of Array.from(summaries.entries())) {
        const sorted = [...names].sort((a, b) => a.localeCompare(b));
        const shown = sorted.slice(0, 4).join(", ");
        reminders.push({
            userId,
            workspaceId,
            kind: "day_before",
            title: `Tomorrow: ${sorted.length} ${sorted.length === 1 ? "task" : "tasks"}`,
            body: sorted.length > 4 ? `${shown} and ${sorted.length - 4} more` : shown,
            url: `/workspaces/${workspaceId}/tasks`,
            scheduledFor: at,
            dedupeKey,
        });
    }

    if (reminders.length === 0) {
        return { created: 0, pushed: 0 };
    }

    // Only reminders not sent before come back
    const created = await db.insert(notifications).values(reminders)
        .onConflictDoNothing({ target: notifications.dedupeKey })
        .returning();

    const byUser = new Map<string, typeof created>();
    for (const notification of created) {
        byUser.set(notification.userId, [...(byUser.get(notification.userId) ?? []), notification]);
    }
    const pushed = await Promise.all(Array.from(byUser.entries()).map(([userId, list]) =>
        pushToUser(userId, list.map((n) => ({ title: n.title, body: n.body, url: n.url, tag: n.dedupeKey })))
    ));

    return { created: created.length, pushed: pushed.reduce((sum, n) => sum + n, 0) };
};
