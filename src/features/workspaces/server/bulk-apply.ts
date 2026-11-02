import "server-only";

import { and, count, eq, inArray, isNull, max, or, sql } from "drizzle-orm";

import { db, type Tx } from "@/lib/db";
import { removeAssignee } from "@/lib/db/assignees";
import { members, projects, routines, tasks, users, workspaceHolidays } from "@/lib/db/schema";
import { toTaskDoc } from "@/features/tasks/server/task-list";
import { generateRoutineTasks, removeRoutineTasksOn, retimeUpcomingRoutineTasks } from "@/lib/routines";
import { localDate } from "@/lib/time-zone";
import { MemberRole } from "@/features/members/types";

import { AMBIGUOUS, sprintDays, taskReferences, type Context, type Planned } from "./bulk-input";
import { assertRoom } from "@/lib/volume-caps";

// What a script can refer to: the workspace's projects, members (people and placeholders),
// routines and days off, and the tasks its update/remove lines name
export const loadContext = async (workspaceId: string, me: string, timeZone: string, role: MemberRole, script: string): Promise<Context> => {
    const wanted = taskReferences(script);
    const [projectRows, memberRows, taskRows, routineRows, holidayRows, taskCounts] = await Promise.all([
        db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.workspaceId, workspaceId)),
        db.select({ member: members, name: users.name, email: users.email })
            .from(members)
            .leftJoin(users, eq(users.id, members.userId))
            .where(eq(members.workspaceId, workspaceId)),
        wanted.names.length || wanted.ids.length
            ? db.select({ id: tasks.id, name: tasks.name, projectId: tasks.projectId, dueDate: tasks.dueDate }).from(tasks).where(and(
                eq(tasks.workspaceId, workspaceId),
                or(
                    wanted.names.length ? inArray(sql`lower(${tasks.name})`, wanted.names) : undefined,
                    wanted.ids.length ? inArray(tasks.id, wanted.ids) : undefined,
                ),
            ))
            : [],
        db.select({ id: routines.id, name: routines.name }).from(routines).where(eq(routines.workspaceId, workspaceId)),
        db.select({ date: workspaceHolidays.date, name: workspaceHolidays.name }).from(workspaceHolidays)
            .where(and(eq(workspaceHolidays.workspaceId, workspaceId), eq(workspaceHolidays.kind, "custom"))),
        // Only "project remove" lines report how many tasks go with the project
        /^\s*project\s+remove\b/im.test(script)
            ? db.select({ projectId: tasks.projectId, count: count() }).from(tasks).where(eq(tasks.workspaceId, workspaceId)).groupBy(tasks.projectId)
            : [],
    ]);

    const memberMap = new Map<string, string>();
    const add = (key: string | null | undefined, id: string) => {
        if (!key) return;
        const lower = key.toLowerCase();
        memberMap.set(lower, memberMap.has(lower) && memberMap.get(lower) !== id ? AMBIGUOUS : id);
    };
    for (const { member, name, email } of memberRows) {
        add(name ?? member.placeholderName, member.id);
        add(email ?? member.placeholderEmail, member.id);
    }

    return {
        projects: new Map(projectRows.map((project) => [project.name.toLowerCase(), project.id])),
        members: memberMap,
        placeholders: new Set(memberRows.filter(({ member }) => member.userId === null).map(({ member }) => member.id)),
        tasks: taskRows.map((task) => ({
            id: task.id, name: task.name, projectId: task.projectId, due: task.dueDate ? localDate(task.dueDate, timeZone) : null,
        })),
        routines: routineRows,
        holidays: new Map(holidayRows.map((holiday) => [holiday.date, holiday.name])),
        projectTaskCounts: new Map(taskCounts.map((row) => [row.projectId, row.count])),
        me,
        role,
        timeZone,
        today: localDate(new Date(), timeZone),
    };
};

// For setting up a brand-new workspace: no projects yet, and its creator (as `me`) is the only
// member, under the id their membership will get
export const newWorkspaceContext = (me: string, user: { name: string; email: string }, timeZone: string): Context => ({
    projects: new Map(),
    members: new Map([[user.name.toLowerCase(), me], [user.email.toLowerCase(), me]]),
    placeholders: new Set(),
    tasks: [],
    routines: [],
    holidays: new Map(),
    projectTaskCounts: new Map(),
    me,
    role: MemberRole.ADMIN,
    timeZone,
    today: localDate(new Date(), timeZone),
});

type Step<K extends Planned["kind"]> = Extract<Planned, { kind: K }>;
export const ofKind = <K extends Planned["kind"]>(plan: Planned[], kind: K) => plan.filter((step): step is Step<K> => step.kind === kind);

// Writes a checked plan inside the caller's transaction (bulk setup also creates the workspace
// in the same one). Order: projects, placeholders, adds, updates, then removes. Requested tasks
// (change requests) are left to the caller. Returns the removed tasks, for Undo.
export const writePlan = async (tx: Tx, workspaceId: string, plan: Planned[]) => {
    const adding = countPlan(plan);
    await assertRoom("projects", workspaceId, adding.project ?? 0, tx);
    await assertRoom("routines", workspaceId, adding.routine ?? 0, tx);
    await assertRoom("tasks", workspaceId, adding.task ?? 0, tx);
    for (const step of ofKind(plan, "project")) {
        await tx.insert(projects).values({
            id: step.id,
            name: step.name,
            workspaceId,
            sprintNumber: 1,
            currentSprintStartDate: step.start,
            currentSprintEndDate: step.end,
            sprintDuration: step.start && step.end ? sprintDays(step.start, step.end) : null,
        });
    }

    for (const step of ofKind(plan, "placeholder")) {
        await tx.insert(members).values({
            id: step.id,
            workspaceId,
            userId: null,
            role: MemberRole.ASSIGNEE,
            placeholderName: step.name,
            placeholderEmail: step.email,
        });
    }

    // New tasks go to the end of their column, in script order
    const taskSteps = ofKind(plan, "task").filter((step) => !step.requested);
    // Every project (and the personal "null" group) of the workspace: at most a few hundred groups
    const highest = taskSteps.length
        ? await tx.select({ projectId: tasks.projectId, status: tasks.status, position: max(tasks.position) })
            .from(tasks)
            .where(eq(tasks.workspaceId, workspaceId))
            .groupBy(tasks.projectId, tasks.status)
        : [];
    const next = new Map(highest.map((row) => [`${row.projectId}:${row.status}`, row.position ?? 0]));
    if (taskSteps.length) {
        await tx.insert(tasks).values(taskSteps.map((step) => {
            const key = `${step.projectId}:${step.status}`;
            const position = (next.get(key) ?? 0) + 1000;
            next.set(key, position);
            return {
                id: step.id,
                name: step.name,
                status: step.status,
                workspaceId,
                projectId: step.projectId,
                assigneeIds: step.assigneeIds,
                dueDate: step.dueDate,
                startAt: step.startAt,
                durationMinutes: step.durationMinutes,
                storyPoints: step.storyPoints,
                description: step.description,
                position,
            };
        }));
    }

    for (const step of plan) {
        if (step.kind === "routine") {
            await tx.insert(routines).values({
                id: step.id,
                name: step.name,
                description: step.description,
                workspaceId,
                projectId: step.projectId,
                assigneeIds: step.assigneeIds,
                weekdays: step.weekdays,
                startTime: step.startTime,
                timeZone: step.timeZone,
                durationMinutes: step.durationMinutes,
                storyPoints: step.storyPoints,
                showInTable: step.showInTable,
                showInKanban: step.showInKanban,
                showInCalendar: step.showInCalendar,
            });
        } else if (step.kind === "holiday") {
            await tx.insert(workspaceHolidays)
                .values({ workspaceId, date: step.date, name: step.name, kind: "custom" })
                .onConflictDoNothing();
        }
    }

    for (const step of plan) {
        if (step.kind === "taskUpdate") {
            await tx.update(tasks).set(step.set).where(and(eq(tasks.id, step.id), eq(tasks.workspaceId, workspaceId)));
        } else if (step.kind === "routineUpdate") {
            await tx.update(routines).set(step.set).where(and(eq(routines.id, step.id), eq(routines.workspaceId, workspaceId)));
        } else if (step.kind === "projectUpdate") {
            await tx.update(projects).set(step.set).where(and(eq(projects.id, step.id), eq(projects.workspaceId, workspaceId)));
        }
    }

    const removeIds = ofKind(plan, "taskRemove").map((step) => step.id);
    const removed = removeIds.length
        ? await tx.delete(tasks).where(and(inArray(tasks.id, removeIds), eq(tasks.workspaceId, workspaceId))).returning()
        : [];
    for (const step of plan) {
        if (step.kind === "routineRemove") {
            // Tasks it already created are kept (routine_id is set to null)
            await tx.delete(routines).where(and(eq(routines.id, step.id), eq(routines.workspaceId, workspaceId)));
        } else if (step.kind === "projectRemove") {
            // Its tasks go with it (ON DELETE CASCADE)
            await tx.delete(projects).where(and(eq(projects.id, step.id), eq(projects.workspaceId, workspaceId)));
        } else if (step.kind === "holidayRemove") {
            await tx.delete(workspaceHolidays).where(and(
                eq(workspaceHolidays.workspaceId, workspaceId),
                eq(workspaceHolidays.date, step.date),
                eq(workspaceHolidays.kind, "custom"),
            ));
        } else if (step.kind === "placeholderRemove") {
            await removeAssignee(tx, step.id, step.fallbackId);
            await tx.delete(members).where(and(eq(members.id, step.id), eq(members.workspaceId, workspaceId), isNull(members.userId)));
        }
    }

    // Snapshots in the shape /api/tasks/restore takes back
    return removed.map(toTaskDoc);
};

// After the commit, as the single-item endpoints do: new days off clear routine tasks on them,
// routines with a new time move their upcoming tasks, and routines fill in their tasks again
export const finishPlan = async (workspaceId: string, plan: Planned[]) => {
    for (const step of plan) {
        if (step.kind === "holiday") await removeRoutineTasksOn(workspaceId, step.date);
    }
    for (const step of ofKind(plan, "routineUpdate").filter((step) => step.retime)) {
        const [routine] = await db.select().from(routines).where(eq(routines.id, step.id));
        if (routine) await retimeUpcomingRoutineTasks(routine.id, routine);
    }
    const regenerate: Planned["kind"][] = ["routine", "holiday", "routineUpdate", "holidayRemove", "projectUpdate"];
    if (plan.some((step) => regenerate.includes(step.kind))) {
        await generateRoutineTasks(eq(routines.workspaceId, workspaceId));
    }
};

// Requested tasks are counted apart, as "request"
export const countPlan = (plan: Planned[]) =>
    plan.reduce<Record<string, number>>((counts, step) => {
        const kind = step.kind === "task" && step.requested ? "request" : step.kind;
        return { ...counts, [kind]: (counts[kind] ?? 0) + 1 };
    }, {});
