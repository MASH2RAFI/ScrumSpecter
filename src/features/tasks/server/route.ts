import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq, ilike, inArray, max, type SQL } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { findForeignReference } from "@/lib/db/workspace-refs";
import { members, projects, tasks, users } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { MemberRole } from "@/features/members/types";
import { requireAdmin, requireMember } from "@/features/members/utils";
import { Project } from "@/features/projects/types";
import { createTaskSchema } from "../schemas";
import { PopulatedAssignee, Task, TaskStatus } from "../types";

const MEMBER_NOT_FOUND = "Member not found in the workspace";

const toTaskDoc = (task: typeof tasks.$inferSelect) => ({
    ...toDoc(task),
    dueDate: task.dueDate?.toISOString() ?? null,
    startAt: task.startAt?.toISOString() ?? null,
}) as Task;

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
                assigneeId,
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

            const isAdmin = member.role === MemberRole.ADMIN;

            if (isAdmin) {
                const foreignReference = await findForeignReference(existingTask.workspaceId, { projectId, assigneeId });
                if (foreignReference) {
                    return c.json({ error: foreignReference }, 400);
                }
            }

            // Non-admins may only update description and status
            const updateData = isAdmin ? {
                name,
                status,
                projectId,
                dueDate,
                assigneeId,
                description,
                storyPoints: storyPoints !== undefined ? Number(storyPoints) : undefined,
                startAt: toStartAt(startAt),
                durationMinutes,
            } : {
                status,
                description,
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

            const member = await requireAdmin(c, task.workspaceId, "Only admins can delete tasks");
            if (member instanceof Response) {
                return member;
            }

            await db.delete(tasks).where(eq(tasks.id, taskId));

            return c.json({ data: { $id: task.id } });
        }
    )

    .get(
        "/",
        sessionMiddleware,
        zValidator(
            "query",
            z.object({
                workspaceId: z.string(),
                projectId: z.string().nullish(),
                assigneeId: z.string().nullish(),
                status: z.nativeEnum(TaskStatus).nullish(),
                search: z.string().nullish(),
                dueDate: z.string().nullish(),
            })
        ),
        async (c) => {
            const {
                workspaceId,
                projectId,
                status,
                search,
                assigneeId,
                dueDate,
            } = c.req.valid("query");

            const filters: SQL[] = [eq(tasks.workspaceId, workspaceId)];

            if (projectId) {
                filters.push(eq(tasks.projectId, projectId));
            }

            if (status) {
                filters.push(eq(tasks.status, status));
            }

            if (assigneeId) {
                filters.push(eq(tasks.assigneeId, assigneeId));
            }

            if (dueDate) {
                filters.push(eq(tasks.dueDate, new Date(dueDate)));
            }

            if (search) {
                filters.push(ilike(tasks.name, `%${search}%`));
            }

            // One round trip for tasks + their project and assignee, run alongside the
            // membership check; rows are only returned once membership is confirmed
            const [member, rows] = await Promise.all([
                requireMember(c, workspaceId, { error: MEMBER_NOT_FOUND }),
                db
                    .select({
                        task: tasks,
                        project: projects,
                        assignee: members,
                        assigneeName: users.name,
                        assigneeEmail: users.email,
                    })
                    .from(tasks)
                    .leftJoin(projects, eq(projects.id, tasks.projectId))
                    .leftJoin(members, eq(members.id, tasks.assigneeId))
                    .leftJoin(users, eq(users.id, members.userId))
                    .where(and(...filters))
                    .orderBy(desc(tasks.createdAt)),
            ]);

            if (member instanceof Response) {
                return member;
            }

            const populatedTasks = rows.map(({ task, project, assignee, assigneeName, assigneeEmail }) => ({
                ...toTaskDoc(task),
                project: project ? toDoc(project) as Project : undefined,
                assignee: assignee && assigneeName !== null && assigneeEmail !== null
                    ? { ...toDoc(assignee), name: assigneeName, email: assigneeEmail } as PopulatedAssignee
                    : null,
            }));

            return c.json({
                data: {
                    documents: populatedTasks,
                    total: populatedTasks.length,
                },
            });
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
                assigneeId,
                description,
                storyPoints,
                startAt,
                durationMinutes,
            } = c.req.valid("json");

            const member = await requireAdmin(c, workspaceId, "Only admins can create tasks", MEMBER_NOT_FOUND);
            if (member instanceof Response) {
                return member;
            }

            const foreignReference = await findForeignReference(workspaceId, { projectId, assigneeId });
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
                    assigneeId,
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

            // Task, project and assignee in one round trip
            const [row] = await db
                .select({
                    task: tasks,
                    project: projects,
                    assignee: members,
                    assigneeName: users.name,
                    assigneeEmail: users.email,
                })
                .from(tasks)
                .leftJoin(projects, eq(projects.id, tasks.projectId))
                .leftJoin(members, eq(members.id, tasks.assigneeId))
                .leftJoin(users, eq(users.id, members.userId))
                .where(eq(tasks.id, taskId))
                .limit(1);

            if (!row) {
                return c.json({ error: "Task not found" }, 404);
            }

            const { task, project, assignee, assigneeName, assigneeEmail } = row;

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
                    assignee: assignee && assigneeName !== null && assigneeEmail !== null
                        ? { ...toDoc(assignee), name: assigneeName, email: assigneeEmail } as PopulatedAssignee
                        : null,
                },
            });
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
                .select({ workspaceId: tasks.workspaceId })
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
