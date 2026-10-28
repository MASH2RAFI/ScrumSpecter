import "server-only";

import { and, eq, inArray, max } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, projects, routines, tasks, users, workspaceHolidays } from "@/lib/db/schema";
import { generateRoutineTasks, removeRoutineTasksOn } from "@/lib/routines";
import { localDate } from "@/lib/reminders";
import { MemberRole } from "@/features/members/types";

import { AMBIGUOUS, type Context, type Planned } from "./bulk-input";

// What a script can refer to: the workspace's projects and members (people and placeholders)
export const loadContext = async (workspaceId: string, me: string, timeZone: string, canManage: boolean): Promise<Context> => {
    const [projectRows, memberRows] = await Promise.all([
        db.select({ id: projects.id, name: projects.name }).from(projects).where(eq(projects.workspaceId, workspaceId)),
        db.select({ member: members, name: users.name, email: users.email })
            .from(members)
            .leftJoin(users, eq(users.id, members.userId))
            .where(eq(members.workspaceId, workspaceId)),
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
        me,
        canManage,
        timeZone,
        today: localDate(new Date(), timeZone),
    };
};

// For setting up a brand-new workspace: no projects yet, and its creator (as `me`) is the only
// member, under the id their membership will get
export const newWorkspaceContext = (me: string, user: { name: string; email: string }, timeZone: string): Context => ({
    projects: new Map(),
    members: new Map([[user.name.toLowerCase(), me], [user.email.toLowerCase(), me]]),
    me,
    canManage: true,
    timeZone,
    today: localDate(new Date(), timeZone),
});

const sprintDays = (start: string, end: string) =>
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Writes a checked plan inside the caller's transaction (bulk setup also creates the workspace
// in the same one)
export const writePlan = async (tx: Tx, workspaceId: string, plan: Planned[]) => {
    for (const step of plan.filter((p) => p.kind === "project")) {
        if (step.kind !== "project") continue;
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

    for (const step of plan) {
        if (step.kind !== "placeholder") continue;
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
    const taskSteps = plan.filter((step): step is Extract<Planned, { kind: "task" }> => step.kind === "task");
    const projectIds = Array.from(new Set(taskSteps.map((step) => step.projectId)));
    const highest = projectIds.length
        ? await tx.select({ projectId: tasks.projectId, status: tasks.status, position: max(tasks.position) })
            .from(tasks)
            .where(and(eq(tasks.workspaceId, workspaceId), inArray(tasks.projectId, projectIds)))
            .groupBy(tasks.projectId, tasks.status)
        : [];
    const next = new Map(highest.map((row) => [`${row.projectId}:${row.status}`, row.position ?? 0]));
    if (taskSteps.length) {
        await tx.insert(tasks).values(taskSteps.map((step) => {
            const key = `${step.projectId}:${step.status}`;
            const position = (next.get(key) ?? 0) + 1000;
            next.set(key, position);
            return {
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
                name: step.name,
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
};

// After the commit: new routines get their tasks; new days off clear routine tasks on them
export const finishPlan = async (workspaceId: string, plan: Planned[]) => {
    for (const step of plan) {
        if (step.kind === "holiday") await removeRoutineTasksOn(workspaceId, step.date);
    }
    if (plan.some((step) => step.kind === "routine" || step.kind === "holiday")) {
        await generateRoutineTasks(eq(routines.workspaceId, workspaceId));
    }
};

export const countPlan = (plan: Planned[]) =>
    plan.reduce<Record<string, number>>((counts, step) => ({ ...counts, [step.kind]: (counts[step.kind] ?? 0) + 1 }), {});

// Writes a checked plan in one transaction: all of it, or (on any error) none of it
export const applyPlan = async (workspaceId: string, plan: Planned[]) => {
    await db.transaction((tx) => writePlan(tx, workspaceId, plan));
    await finishPlan(workspaceId, plan);
    return countPlan(plan);
};
