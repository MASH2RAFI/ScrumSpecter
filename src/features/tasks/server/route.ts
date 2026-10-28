import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, inArray, max, ne } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { findForeignReference } from "@/lib/db/workspace-refs";
import { members, projects, routines, tasks, users } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { canEditDescription, canEditWork, canReview, canSetStatus } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";
import { requireMember, requireRole } from "@/features/members/utils";
import { Project } from "@/features/projects/types";
import { bulkEditSchema, createTaskSchema, restoreTasksSchema } from "../schemas";
import { baseFilters, countTasks, hiddenRoutineCount, listQuerySchema, orderFor, routineRule, selectTasks, taskSummary } from "./task-list";
import { PopulatedAssignee, Task, TaskStatus } from "../types";

const MEMBER_NOT_FOUND = "Member not found in the workspace";

const toTaskDoc = (task: typeof tasks.$inferSelect) => ({
    ...toDoc(task),
    dueDate: task.dueDate?.toISOString() ?? null,
    startAt: task.startAt?.toISOString() ?? null,
}) as Task;

// Names for the assignees of a set of tasks, in one query: people's own, or a placeholder's
const loadAssignees = async (taskRows: { assigneeIds: string[] }[]) => {
    const ids = Array.from(new Set(taskRows.flatMap((task) => task.assigneeIds)));
    if (ids.length === 0) return new Map<string, PopulatedAssignee>();
    const rows = await db
        .select({ member: members, name: users.name, email: users.email })
        .from(members)
        .leftJoin(users, eq(users.id, members.userId))
        .where(inArray(members.id, ids));
    return new Map(rows.flatMap(({ member, name, email }) => {
        const shownName = name ?? member.placeholderName;
        if (shownName === null) return [];
        return [[member.id, {
            ...toDoc(member),
            name: shownName,
            email: email ?? member.placeholderEmail ?? "",
            isPlaceholder: member.userId === null,
        } as PopulatedAssignee]];
    }));
};

const withAssignees = (task: typeof tasks.$inferSelect, people: Map<string, PopulatedAssignee>) => {
    const assignees = task.assigneeIds.flatMap((id) => people.get(id) ?? []);
    return { assignees, assignee: assignees[0] ?? null };
};

// undefined = leave unchanged, null = clear, string = set
const toStartAt = (startAt: string | null | undefined) =>
    startAt === undefined ? undefined : startAt === null ? null : new Date(startAt);

const app = new Hono()
    .patch(
        "/:taskId",
        sessionMiddleware,
        zValidator("json", createTaskSchema.partial()),
        async (c) => {
            const {
                name,
                status,
                projectId,
                dueDate,
                assigneeIds,
                description,
                storyPoints,
                startAt,
                durationMinutes,
            } = c.req.valid("json");

            const { taskId } = c.req.param();

            const existingTask = await findById(tasks, taskId);

            if (!existingTask) {
                return c.json({ error: "Task not found" }, 404);
            }

            const member = await requireMember(c, existingTask.workspaceId, { error: MEMBER_NOT_FOUND });
            if (member instanceof Response) {
                return member;
            }

            const isAssignee = existingTask.assigneeIds.includes(member.$id);
            const editsWork = [name, projectId, dueDate, assigneeIds, storyPoints, startAt, durationMinutes].some((value) => value !== undefined);

            if (editsWork && !canEditWork(member.role)) {
                return c.json({ error: "Only admins and supervisors can change this. Send a change request instead." }, 403);
            }
            if (status !== undefined && status !== existingTask.status
                && !canSetStatus(member.role, { isAssignee, from: existingTask.status, to: status })) {
                return c.json({ error: status === TaskStatus.DONE || existingTask.status === TaskStatus.DONE
                    ? "A reviewer approves work to Done. Move it to In Review."
                    : "You can only change the status of tasks assigned to you" }, 403);
            }
            if (description !== undefined && !canEditDescription(member.role, isAssignee)) {
                return c.json({ error: "You can only edit tasks assigned to you" }, 403);
            }

            if (editsWork) {
                const foreignReference = await findForeignReference(existingTask.workspaceId, { projectId, assigneeIds });
                if (foreignReference) {
                    return c.json({ error: foreignReference }, 400);
                }
            }

            const updateData = {
                name,
                status,
                projectId,
                dueDate,
                assigneeIds: assigneeIds ? Array.from(new Set(assigneeIds)) : undefined,
                description,
                storyPoints: storyPoints !== undefined ? Number(storyPoints) : undefined,
                startAt: toStartAt(startAt),
                durationMinutes,
            };

            // Drizzle rejects an update with nothing to set
            if (Object.values(updateData).every((value) => value === undefined)) {
                return c.json({ data: toTaskDoc(existingTask) });
            }

            const [task] = await db
                .update(tasks)
                .set(updateData)
                .where(eq(tasks.id, taskId))
                .returning();

            return c.json({ data: toTaskDoc(task) });
        }
    )

    .delete(
        "/:taskId",
        sessionMiddleware,
        async (c) => {
            const { taskId } = c.req.param();
            const task = await findById(tasks, taskId);

            if (!task) {
                return c.json({ error: "Task not found" }, 404);
            }

            const member = await requireRole(c, task.workspaceId, canEditWork, "Only admins and supervisors can delete tasks");
            if (member instanceof Response) {
                return member;
            }

            await db.delete(tasks).where(eq(tasks.id, taskId));

            return c.json({ data: { $id: task.id } });
        }
    )

    // Tasks for a workspace; see task-list.ts for the optional paging, ranges and view scopes
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", listQuerySchema),
        async (c) => {
            const q = c.req.valid("query");
            const filters = baseFilters(q);
            const rule = routineRule(q);
            const where = and(...filters, rule);

            // Kanban (with no status filter): every open task, but only the most recently
            // finished Done ones, as that column only ever grows
            const capDone = q.scope === "kanban" && q.doneLimit && !q.status;
            const page = q.limit !== undefined;

            const member = await requireMember(c, q.workspaceId, { error: MEMBER_NOT_FOUND });
            if (member instanceof Response) {
                return member;
            }

            const [rows, total, doneRows, doneTotal, hiddenRoutineTasks] = await Promise.all([
                (() => {
                    const query = selectTasks(capDone ? and(where, ne(tasks.status, TaskStatus.DONE)) : where).orderBy(...orderFor(q));
                    return page ? query.limit(q.limit!).offset(q.offset ?? 0) : query;
                })(),
                page ? countTasks(where) : null,
                capDone
                    ? selectTasks(and(where, eq(tasks.status, TaskStatus.DONE))).orderBy(desc(tasks.updatedAt)).limit(q.doneLimit!)
                    : [],
                capDone ? countTasks(and(where, eq(tasks.status, TaskStatus.DONE))) : null,
                q.scope === "table" || q.scope === "kanban" ? hiddenRoutineCount(q, filters) : 0,
            ]);

            const all = [...rows, ...doneRows];
            const people = await loadAssignees(all.map(({ task }) => task));
            const documents = all.map(({ task, project }) => ({
                ...toTaskDoc(task),
                project: project ? toDoc(project) as Project : undefined,
                ...withAssignees(task, people),
            }));

            return c.json({
                data: {
                    documents,
                    // Every match, not just this page (or this many Done ones)
                    total: total ?? (capDone ? rows.length + (doneTotal ?? 0) : documents.length),
                    doneTotal,
                    hiddenRoutineTasks,
                },
            });
        }
    )

    // Home's numbers for this week, counted in the database
    .get(
        "/summary",
        sessionMiddleware,
        zValidator("query", z.object({
            workspaceId: z.string(),
            weekFrom: z.string().datetime({ offset: true }),
            weekTo: z.string().datetime({ offset: true }),
        })),
        async (c) => {
            const { workspaceId, weekFrom, weekTo } = c.req.valid("query");
            const member = await requireMember(c, workspaceId, { error: MEMBER_NOT_FOUND });
            if (member instanceof Response) {
                return member;
            }
            return c.json({ data: await taskSummary(workspaceId, weekFrom, weekTo) });
        }
    )

    .post(
        "/",
        sessionMiddleware,
        zValidator("json", createTaskSchema),
        async (c) => {
            const {
                name,
                status,
                workspaceId,
                projectId,
                dueDate,
                assigneeIds,
                description,
                storyPoints,
                startAt,
                durationMinutes,
            } = c.req.valid("json");

            const member = await requireRole(c, workspaceId, canEditWork, "Only admins and supervisors can create tasks. Send a change request instead.", MEMBER_NOT_FOUND);
            if (member instanceof Response) {
                return member;
            }

            const foreignReference = await findForeignReference(workspaceId, { projectId, assigneeIds });
            if (foreignReference) {
                return c.json({ error: foreignReference }, 400);
            }

            const [highestPosition] = await db
                .select({ position: max(tasks.position) })
                .from(tasks)
                .where(and(eq(tasks.status, status), eq(tasks.projectId, projectId)));

            const newPosition = (highestPosition?.position ?? 0) + 1000;

            const [task] = await db
                .insert(tasks)
                .values({
                    name,
                    status,
                    workspaceId,
                    projectId,
                    dueDate,
                    assigneeIds: Array.from(new Set(assigneeIds)),
                    description,
                    storyPoints: storyPoints !== undefined ? Number(storyPoints) : undefined,
                    startAt: toStartAt(startAt),
                    durationMinutes,
                    position: newPosition,
                })
                .returning();

            return c.json({ data: toTaskDoc(task) });
        }
    )

    .get(
        "/:taskId",
        sessionMiddleware,
        async (c) => {
            const { taskId } = c.req.param();

            // Task and project in one round trip
            const [row] = await db
                .select({ task: tasks, project: projects })
                .from(tasks)
                .leftJoin(projects, eq(projects.id, tasks.projectId))
                .where(eq(tasks.id, taskId))
                .limit(1);

            if (!row) {
                return c.json({ error: "Task not found" }, 404);
            }

            const { task, project } = row;

            const member = await requireMember(c, task.workspaceId);
            if (member instanceof Response) {
                return member;
            }

            if (!project) {
                return c.json({ error: "Project not found" }, 404);
            }

            return c.json({
                data: {
                    ...toTaskDoc(task),
                    project: toDoc(project) as Project,
                    ...withAssignees(task, await loadAssignees([task])),
                },
            });
        }
    )

    // Several tasks at once from the table: the same change for all, or delete them.
    // Returns their previous state so the change can be undone.
    .post(
        "/bulk-edit",
        sessionMiddleware,
        zValidator("json", bulkEditSchema),
        async (c) => {
            const { ids, changes } = c.req.valid("json");

            const selected = await db.select().from(tasks).where(inArray(tasks.id, ids));
            const workspaceIds = new Set(selected.map((task) => task.workspaceId));
            if (selected.length === 0 || workspaceIds.size !== 1) {
                return c.json({ error: "All tasks must belong to the same workspace" }, 400);
            }
            const workspaceId = selected[0].workspaceId;

            const member = await requireMember(c, workspaceId, { error: MEMBER_NOT_FOUND });
            if (member instanceof Response) {
                return member;
            }
            // Reviewers may change status in bulk; everything else is for admins and supervisors
            const statusOnly = !("delete" in changes) && Object.keys(changes).every((key) => key === "status");
            if (!(statusOnly ? canReview(member.role) : canEditWork(member.role))) {
                return c.json({ error: statusOnly ? "Only reviewers, supervisors and admins can change several tasks at once" : "Only admins and supervisors can change these fields" }, 403);
            }

            if ("delete" in changes) {
                await db.delete(tasks).where(and(inArray(tasks.id, ids), eq(tasks.workspaceId, workspaceId)));
                return c.json({ data: { previous: selected.map(toTaskDoc), deleted: true } });
            }

            const foreignReference = await findForeignReference(workspaceId, { assigneeIds: changes.assigneeIds });
            if (foreignReference) {
                return c.json({ error: foreignReference }, 400);
            }

            const set = {
                status: changes.status,
                assigneeIds: changes.assigneeIds ? Array.from(new Set(changes.assigneeIds)) : undefined,
                dueDate: changes.dueDate === undefined ? undefined : changes.dueDate === null ? null : new Date(changes.dueDate),
            };
            if (Object.values(set).every((value) => value === undefined)) {
                return c.json({ error: "Nothing to change" }, 400);
            }

            await db.update(tasks).set(set).where(and(inArray(tasks.id, ids), eq(tasks.workspaceId, workspaceId)));
            return c.json({ data: { previous: selected.map(toTaskDoc), deleted: false } });
        }
    )

    // Puts deleted tasks back exactly as they were (Undo after delete); admins only
    .post(
        "/restore",
        sessionMiddleware,
        zValidator("json", restoreTasksSchema),
        async (c) => {
            const { tasks: snapshots } = c.req.valid("json");
            const workspaceIds = new Set(snapshots.map((task) => task.workspaceId));
            if (workspaceIds.size !== 1) {
                return c.json({ error: "All tasks must belong to the same workspace" }, 400);
            }
            const workspaceId = snapshots[0].workspaceId;

            const member = await requireRole(c, workspaceId, canEditWork, "Only admins and supervisors can restore tasks", MEMBER_NOT_FOUND);
            if (member instanceof Response) {
                return member;
            }
            for (const snapshot of snapshots) {
                const foreignReference = await findForeignReference(workspaceId, { projectId: snapshot.projectId, assigneeIds: snapshot.assigneeIds });
                if (foreignReference) {
                    return c.json({ error: foreignReference }, 400);
                }
            }

            // A routine deleted meanwhile can't be pointed at any more
            const routineIds = Array.from(new Set(snapshots.map((task) => task.routineId).filter((id): id is string => Boolean(id))));
            const liveRoutines = new Set(routineIds.length
                ? (await db.select({ id: routines.id }).from(routines).where(inArray(routines.id, routineIds))).map((row) => row.id)
                : []);

            const restored = await db.insert(tasks).values(snapshots.map((task) => ({
                id: task.$id,
                name: task.name,
                status: task.status,
                workspaceId: task.workspaceId,
                projectId: task.projectId,
                assigneeIds: task.assigneeIds,
                description: task.description,
                storyPoints: task.storyPoints,
                position: task.position,
                dueDate: task.dueDate ? new Date(task.dueDate) : null,
                startAt: task.startAt ? new Date(task.startAt) : null,
                durationMinutes: task.durationMinutes,
                sprintId: task.sprintId,
                routineId: task.routineId && liveRoutines.has(task.routineId) ? task.routineId : null,
            // Skips a task that exists again meanwhile (same id, or its routine re-created that day)
            }))).onConflictDoNothing().returning({ id: tasks.id });

            return c.json({ data: { restored: restored.length } });
        }
    )

    .post(
        "/bulk-update",
        sessionMiddleware,
        zValidator(
            "json",
            z.object({
                tasks: z.array(
                    z.object({
                        $id: z.string(),
                        status: z.nativeEnum(TaskStatus),
                        position: z.number().int().positive().min(1000).max(1_000_000),
                    })
                )
            })
        ),
        async (c) => {
            const { tasks: taskUpdates } = c.req.valid("json");

            const tasksToUpdate = await db
                .select({ id: tasks.id, workspaceId: tasks.workspaceId, status: tasks.status, assigneeIds: tasks.assigneeIds })
                .from(tasks)
                .where(inArray(tasks.id, taskUpdates.map((task) => task.$id)));

            const workspaceIds = new Set(tasksToUpdate.map((task) => task.workspaceId));

            if (workspaceIds.size !== 1) {
                return c.json({ error: "All tasks must belong to the same workspace" }, 400);
            }

            const workspaceId = workspaceIds.values().next().value;

            if (!workspaceId) {
                return c.json({ error: "Workspace ID is required" }, 400);
            }

            const member = await requireMember(c, workspaceId);
            if (member instanceof Response) {
                return member;
            }

            // Dragging between columns is a status change, with the same rules as anywhere else;
            // reordering within a column is fine for anyone who can work on tasks
            const current = new Map(tasksToUpdate.map((task) => [task.id, task]));
            for (const update of taskUpdates) {
                const task = current.get(update.$id);
                if (!task) continue;
                const allowed = task.status === update.status
                    ? member.role !== MemberRole.VIEWER
                    : canSetStatus(member.role, { isAssignee: task.assigneeIds.includes(member.$id), from: task.status, to: update.status });
                if (!allowed) {
                    return c.json({ error: update.status === TaskStatus.DONE || task.status === TaskStatus.DONE
                        ? "A reviewer approves work to Done. Move it to In Review."
                        : "You can only move tasks assigned to you" }, 403);
                }
            }

            const updatedTasks = await db.transaction((tx) =>
                Promise.all(
                    taskUpdates.map(async ({ $id, status, position }) => {
                        const [task] = await tx
                            .update(tasks)
                            .set({ status, position })
                            .where(and(eq(tasks.id, $id), eq(tasks.workspaceId, workspaceId)))
                            .returning();
                        return task;
                    })
                )
            );

            // Tasks deleted mid-drag (or ids from another workspace) are skipped, not fatal
            return c.json({
                data: updatedTasks
                    .filter((task): task is typeof tasks.$inferSelect => task !== undefined)
                    .map(toTaskDoc),
            });
        }
    );

export default app;
