import "server-only";

import { z } from "zod";
import { and, arrayOverlaps, asc, count, desc, eq, gte, inArray, isNull, lt, ne, notInArray, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, projects, routines, stars, tasks, users, workspaces } from "@/lib/db/schema";

import { toDoc } from "@/lib/db/types";

import { Task, TaskStatus } from "../types";
import { DEFAULT_DURATION_MINUTES } from "../task-time";
import { idString } from "@/lib/limits";
import { isValidTimeZone } from "@/lib/time-zone";

// A task row as the API sends it (dates as ISO strings); also the shape /api/tasks/restore takes back
export const toTaskDoc = (task: typeof tasks.$inferSelect) => ({
    ...toDoc(task),
    dueDate: task.dueDate?.toISOString() ?? null,
    startAt: task.startAt?.toISOString() ?? null,
}) as Task;

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

const isoDate = z.string().datetime({ offset: true });
const flag = z.enum(["true", "false"]).transform((value) => value === "true");

export const listQuerySchema = z.object({
    workspaceId: idString,
    projectId: idString.nullish(),
    assigneeId: idString.nullish(),
    status: z.nativeEnum(TaskStatus).nullish(),
    search: z.string().max(200).nullish(),
    scope: z.enum(TASK_SCOPES).optional(),
    // The viewer's current week, [weekFrom, weekTo); needed for the list scopes' routine rule
    weekFrom: isoDate.optional(),
    weekTo: isoDate.optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    unscheduled: flag.optional(),
    openOnly: flag.optional(),
    // Only what the caller starred: the task itself, or the routine it came from
    starred: flag.optional(),
    // The saved My Tasks filter: several people (member ids or "me") and statuses, each "any of";
    // overdue: not done and past its end (time block, else the due date's end of working day)
    assignees: z.string().max(4000).optional(),
    statuses: z.string().max(200).optional(),
    overdue: flag.optional(),
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

const list = (value: string | null | undefined) => (value ?? "").split(",").map((part) => part.trim()).filter(Boolean);

// When a task ends, as SQL: the same rule as taskEndAt in the browser and taskEnd in the reminder
// and Backlog jobs. A time block ends at its start + length; a date-only task at the end of the
// working day ("HH:MM" in `dayEnd`) on its calendar date IN THE VIEWER'S TIME ZONE. (Adding the
// day end to the stored instant is only right for dates stored as local midnight; routines store
// noon UTC, so it ended them hours late.)
export const endsAtSql = (timeZone: string, dayEnd: SQL) => {
    const zone = isValidTimeZone(timeZone) ? timeZone : "Asia/Dhaka";
    return sql`case
        when ${tasks.startAt} is not null then ${tasks.startAt} + make_interval(mins => coalesce(${tasks.durationMinutes}, ${DEFAULT_DURATION_MINUTES}))
        when ${tasks.dueDate} is not null then ((${tasks.dueDate} at time zone ${zone})::date + ${dayEnd}::interval) at time zone ${zone}
    end`;
};

// Each task's own workspace's working-day end
const workspaceDayEnd = sql`coalesce((select ${workspaces.workDayEnd} from ${workspaces} where ${workspaces.id} = ${tasks.workspaceId}), '18:00')`;

export type SavedFilterQuery = Pick<ListQuery, "assignees" | "statuses" | "starred" | "overdue" | "excludeProjects">;

// The saved My Tasks filter as SQL; Home's summary applies the same
export const savedFilters = (q: SavedFilterQuery, memberId: string, userId: string, timeZone: string): SQL[] => {
    const filters: SQL[] = [];
    const people = list(q.assignees).slice(0, 50).map((id) => (id === "me" ? memberId : id));
    if (people.length) filters.push(arrayOverlaps(tasks.assigneeIds, people));
    const statuses = list(q.statuses).filter((status): status is TaskStatus => (Object.values(TaskStatus) as string[]).includes(status));
    if (statuses.length) filters.push(inArray(tasks.status, statuses));
    if (q.starred) filters.push(sql`exists (select 1 from ${stars} where ${stars.userId} = ${userId}
        and (${stars.taskId} = ${tasks.id} or ${stars.routineId} = ${tasks.routineId}))`);
    if (q.overdue) filters.push(and(ne(tasks.status, TaskStatus.DONE), sql`${endsAtSql(timeZone, workspaceDayEnd)} < now()`)!);
    const hidden = notInProjects(q.excludeProjects);
    if (hidden) filters.push(hidden);
    return filters;
};

// Filters that don't depend on the scope
// memberId / userId: the caller's member id ("assigneeId=me") and account (their stars)
export const baseFilters = (q: ListQuery, memberId: string, userId: string, timeZone: string): SQL[] => {
    const filters: SQL[] = [eq(tasks.workspaceId, q.workspaceId)];
    // "none": personal tasks (no project)
    if (q.projectId) filters.push(q.projectId === "none" ? isNull(tasks.projectId) : eq(tasks.projectId, q.projectId));
    if (q.status) filters.push(eq(tasks.status, q.status));
    if (q.openOnly) filters.push(ne(tasks.status, TaskStatus.DONE));
    filters.push(...savedFilters(q, memberId, userId, timeZone));
    if (q.assigneeId) filters.push(sql`${q.assigneeId === "me" ? memberId : q.assigneeId} = any(${tasks.assigneeIds})`);
    if (q.search) filters.push(sql`${tasks.name} ilike ${`%${q.search.replace(/[\\%_]/g, "\\$&")}%`}`);
    if (q.from) filters.push(gte(tasks.dueDate, new Date(q.from)));
    if (q.to) filters.push(lt(tasks.dueDate, new Date(q.to)));
    if (q.unscheduled) filters.push(isNull(tasks.dueDate));
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
// "Hidden in My Tasks" (the eye beside each project, a comma-separated id list) as a filter
export const notInProjects = (excludeProjects: string | null | undefined) => {
    const hidden = (excludeProjects ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 200);
    // NOT IN is never true for NULL, so personal tasks need their own branch to stay visible
    return hidden.length ? or(isNull(tasks.projectId), notInArray(tasks.projectId, hidden)) : undefined;
};

// filters: the saved My Tasks filter (savedFilters), which Home follows
export const taskSummary = async (workspaceId: string, weekFrom: string, weekTo: string, filters: SQL[], timeZone: string, now = new Date()) => {
    const [workspace] = await db.select({ dayEnd: workspaces.workDayEnd }).from(workspaces).where(eq(workspaces.id, workspaceId));
    const dayEnd = workspace?.dayEnd ?? "18:00";
    const scope = and(eq(tasks.workspaceId, workspaceId), or(isNull(tasks.routineId), inRoutineWeek(weekFrom, weekTo)), ...filters);
    const open = ne(tasks.status, TaskStatus.DONE);
    const endsAt = endsAtSql(timeZone, sql`${dayEnd}`);

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
            overdue: sql<number>`count(*) filter (where ${open} and ${endsAt} < ${now})`.mapWith(Number),
        }).from(tasks).where(and(eq(tasks.workspaceId, workspaceId), ...filters)).groupBy(tasks.projectId)
            // Per-project numbers leave out personal tasks (the totals above still count them)
            .then((rows) => rows.flatMap((row) => row.projectId ? [{ ...row, projectId: row.projectId }] : [])),
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

// The live counts on My Tasks' filter chips. Each row is counted with every other choice applied
// but its own, so a chip's number is what picking it would show (like a faceted search).
export const taskFacets = async (q: ListQuery, memberId: string, userId: string, timeZone: string) => {
    const where = (without: Partial<ListQuery>) => and(...baseFilters({ ...q, ...without }, memberId, userId, timeZone), routineRule(q));
    const counted = (condition: SQL | undefined) => db.select({ n: count() }).from(tasks)
        .leftJoin(routines, eq(routines.id, tasks.routineId)).where(condition).then((rows) => rows[0]?.n ?? 0);

    const peopleWhere = where({ assignees: undefined });
    const statusWhere = where({ statuses: undefined });
    const [everyone, perPerson, allStatuses, perStatus, starred, overdue] = await Promise.all([
        counted(peopleWhere),
        db.execute<{ member_id: string; n: number }>(sql`
            select a.member_id, count(*)::int as n
            from ${tasks} left join ${routines} on ${routines.id} = ${tasks.routineId}
            cross join unnest(${tasks.assigneeIds}) as a(member_id)
            where ${peopleWhere}
            group by a.member_id`),
        counted(statusWhere),
        db.select({ status: tasks.status, n: count() }).from(tasks)
            .leftJoin(routines, eq(routines.id, tasks.routineId)).where(statusWhere).groupBy(tasks.status),
        counted(and(where({ starred: undefined }), ...savedFilters({ starred: true }, memberId, userId, timeZone))),
        counted(and(where({ overdue: undefined }), ...savedFilters({ overdue: true }, memberId, userId, timeZone))),
    ]);
    return {
        everyone,
        people: Object.fromEntries(perPerson.rows.map((row) => [row.member_id, Number(row.n)])),
        allStatuses,
        statuses: Object.fromEntries(perStatus.map((row) => [row.status, row.n])),
        starred,
        overdue,
    };
};
