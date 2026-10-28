import "server-only";

import { z } from "zod";
import { and, asc, count, desc, eq, gte, inArray, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, projects, routines, tasks, users, workspaces } from "@/lib/db/schema";

import { TaskStatus } from "../types";
import { DEFAULT_DURATION_MINUTES } from "../task-time";

// GET /api/tasks: everything but workspaceId is optional, and with none of the extras it returns
// every matching task as before. The extras let views load only what they show, so large
// workspaces stay fast:
//   scope     the view asking; applies the routine rules (list views: this week's, not done,
//             unless the routine is switched off for that view; calendar: all, unless switched off)
//   from, to  due date range (calendar, a week); unscheduled: tasks with no due date
//   ids       specific tasks (the Requests page)
//   limit/offset with sortBy/sortDir: one page of the table
//   doneLimit (kanban): only the most recently finished Done tasks
export const SORT_KEYS = ["name", "project", "assignee", "dueDate", "storyPoints", "status", "createdAt"] as const;
export const TASK_SCOPES = ["table", "kanban", "calendar", "home"] as const;
export type TaskScope = (typeof TASK_SCOPES)[number];

const isoDate = z.string().datetime({ offset: true });
const flag = z.enum(["true", "false"]).transform((value) => value === "true");

export const listQuerySchema = z.object({
    workspaceId: z.string(),
    projectId: z.string().nullish(),
    assigneeId: z.string().nullish(),
    status: z.nativeEnum(TaskStatus).nullish(),
    search: z.string().nullish(),
    dueDate: z.string().nullish(),
    scope: z.enum(TASK_SCOPES).optional(),
    // The viewer's current week, [weekFrom, weekTo); needed for the list scopes' routine rule
    weekFrom: isoDate.optional(),
    weekTo: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    unscheduled: flag.optional(),
    openOnly: flag.optional(),
    ids: z.string().max(4000).optional(),
    // Projects to leave out (My Tasks' hidden projects)
    excludeProjects: z.string().max(4000).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
    offset: z.coerce.number().int().min(0).optional(),
    sortBy: z.enum(SORT_KEYS).optional(),
    sortDir: z.enum(["asc", "desc"]).optional(),
    doneLimit: z.coerce.number().int().min(1).max(500).optional(),
}).refine((q) => !(q.scope && q.scope !== "calendar") || (q.weekFrom && q.weekTo), {
    message: "weekFrom and weekTo are needed for this scope",
});

export type ListQuery = z.infer<typeof listQuerySchema>;

const VIEW_FLAG = { table: routines.showInTable, kanban: routines.showInKanban, calendar: routines.showInCalendar } as const;

// This week's routine tasks that aren't done; other routine tasks are on the calendar only
const inRoutineWeek = (weekFrom: string, weekTo: string) =>
    and(gte(tasks.dueDate, new Date(weekFrom)), lt(tasks.dueDate, new Date(weekTo)), ne(tasks.status, TaskStatus.DONE));

// Which routine tasks a view shows (needs routines left-joined)
export const routineRule = (q: ListQuery): SQL | undefined => {
    if (!q.scope) return undefined;
    if (q.scope === "calendar") return or(isNull(tasks.routineId), eq(VIEW_FLAG.calendar, true));
    const week = inRoutineWeek(q.weekFrom!, q.weekTo!);
    if (q.scope === "home") return or(isNull(tasks.routineId), week);
    return or(isNull(tasks.routineId), and(eq(VIEW_FLAG[q.scope], true), week));
};

// Filters that don't depend on the scope
export const baseFilters = (q: ListQuery): SQL[] => {
    const filters: SQL[] = [eq(tasks.workspaceId, q.workspaceId)];
    if (q.projectId) filters.push(eq(tasks.projectId, q.projectId));
    if (q.status) filters.push(eq(tasks.status, q.status));
    if (q.openOnly) filters.push(ne(tasks.status, TaskStatus.DONE));
    if (q.assigneeId) filters.push(sql`${q.assigneeId} = any(${tasks.assigneeIds})`);
    if (q.dueDate) filters.push(eq(tasks.dueDate, new Date(q.dueDate)));
    if (q.search) filters.push(sql`${tasks.name} ilike ${`%${q.search.replace(/[\\%_]/g, "\\$&")}%`}`);
    if (q.from) filters.push(gte(tasks.dueDate, new Date(q.from)));
    if (q.to) filters.push(lt(tasks.dueDate, new Date(q.to)));
    if (q.unscheduled) filters.push(isNull(tasks.dueDate));
    if (q.excludeProjects) {
        const hidden = q.excludeProjects.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 200);
        if (hidden.length) filters.push(notInArray(tasks.projectId, hidden));
    }
    if (q.ids) {
        const ids = q.ids.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 200);
        filters.push(ids.length ? inArray(tasks.id, ids) : sql`false`);
    }
    return filters;
};

// The first assignee's name, for sorting by assignee
const firstAssigneeName = sql`(select coalesce(${users.name}, ${members.placeholderName})
    from ${members} left join ${users} on ${users.id} = ${members.userId}
    where ${members.id} = ${tasks.assigneeIds}[1])`;

export const orderFor = (q: ListQuery) => {
    const dir = q.sortDir === "asc" ? asc : desc;
    const key = q.sortBy ?? "createdAt";
    const column = {
        name: sql`lower(${tasks.name})`,
        project: sql`lower(${projects.name})`,
        assignee: sql`lower(${firstAssigneeName})`,
        dueDate: tasks.dueDate,
        storyPoints: tasks.storyPoints,
        status: tasks.status,
        createdAt: tasks.createdAt,
    }[key];
    // A stable order, so pages never repeat or skip a task
    return [sql`${dir(column)} nulls last`, desc(tasks.createdAt), asc(tasks.id)];
};

// The rows for a query: tasks with their project
export const selectTasks = (where: SQL | undefined) =>
    db
        .select({ task: tasks, project: projects })
        .from(tasks)
        .leftJoin(projects, eq(projects.id, tasks.projectId))
        .leftJoin(routines, eq(routines.id, tasks.routineId))
        .where(where);

export const countTasks = async (where: SQL | undefined) => {
    const [row] = await db
        .select({ n: count() })
        .from(tasks)
        .leftJoin(routines, eq(routines.id, tasks.routineId))
        .where(where);
    return row?.n ?? 0;
};

// List views: routine tasks hidden by the week rule that the calendar still shows (for the
// "N routine tasks are on the Calendar" note)
export const hiddenRoutineCount = (q: ListQuery, filters: SQL[]) =>
    countTasks(and(
        ...filters,
        sql`${tasks.routineId} is not null`,
        eq(VIEW_FLAG.calendar, true),
        sql`not (${inRoutineWeek(q.weekFrom!, q.weekTo!)})`,
    ));

// Home's numbers, counted in the database. Tasks are the "home" scope ones (routine tasks only
// this week's and not done); `overdue` mirrors taskEndAt: a timed task ends at start + duration,
// a date-only one at the end of the working day on its due date.
export const taskSummary = async (workspaceId: string, weekFrom: string, weekTo: string, now = new Date()) => {
    const [workspace] = await db.select({ dayEnd: workspaces.workDayEnd }).from(workspaces).where(eq(workspaces.id, workspaceId));
    const dayEnd = workspace?.dayEnd ?? "18:00";
    const scope = and(eq(tasks.workspaceId, workspaceId), or(isNull(tasks.routineId), inRoutineWeek(weekFrom, weekTo)));
    const open = ne(tasks.status, TaskStatus.DONE);
    const endsAt = sql`case
        when ${tasks.startAt} is not null then ${tasks.startAt} + make_interval(mins => coalesce(${tasks.durationMinutes}, ${DEFAULT_DURATION_MINUTES}))
        when ${tasks.dueDate} is not null then ${tasks.dueDate} + ${dayEnd}::interval
    end`;

    const [totals, perProject, perMember] = await Promise.all([
        db.select({
            total: count(),
            done: sql<number>`count(*) filter (where ${tasks.status} = ${TaskStatus.DONE})`.mapWith(Number),
            inProgress: sql<number>`count(*) filter (where ${tasks.status} in (${TaskStatus.IN_PROGRESS}, ${TaskStatus.IN_REVIEW}))`.mapWith(Number),
            inReview: sql<number>`count(*) filter (where ${tasks.status} = ${TaskStatus.IN_REVIEW})`.mapWith(Number),
            overdue: sql<number>`count(*) filter (where ${open} and ${endsAt} < ${now})`.mapWith(Number),
        }).from(tasks).where(scope),
        // Sprint progress counts every task of the project, routine ones included
        db.select({
            projectId: tasks.projectId,
            tasks: count(),
            doneTasks: sql<number>`count(*) filter (where ${tasks.status} = ${TaskStatus.DONE})`.mapWith(Number),
            points: sql<number>`coalesce(sum(${tasks.storyPoints}), 0)`.mapWith(Number),
            donePoints: sql<number>`coalesce(sum(${tasks.storyPoints}) filter (where ${tasks.status} = ${TaskStatus.DONE}), 0)`.mapWith(Number),
            progressPoints: sql<number>`coalesce(sum(${tasks.storyPoints}) filter (where ${tasks.status} in (${TaskStatus.IN_PROGRESS}, ${TaskStatus.IN_REVIEW})), 0)`.mapWith(Number),
            overdue: sql<number>`count(*) filter (where ${open} and ${tasks.dueDate} < ${now})`.mapWith(Number),
        }).from(tasks).where(eq(tasks.workspaceId, workspaceId)).groupBy(tasks.projectId),
        // Each assignee of each open task, counted per member
        db.execute<{ member_id: string; open: number }>(sql`
            select a.member_id, count(*)::int as open
            from ${tasks} cross join unnest(${tasks.assigneeIds}) as a(member_id)
            where ${and(scope, open)}
            group by a.member_id`),
    ]);

    return {
        ...totals[0],
        projects: perProject,
        openByMember: Object.fromEntries(perMember.rows.map((row) => [row.member_id, Number(row.open)])),
    };
};
