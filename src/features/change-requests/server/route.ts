import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, count, desc, eq, inArray, isNotNull, max, TransactionRollbackError } from "drizzle-orm";

import { db } from "@/lib/db";
import { changeRequests, members, notifications, tasks, users } from "@/lib/db/schema";
import { findById } from "@/lib/db/find-by-id";
import { findForeignReference } from "@/lib/db/workspace-refs";
import { pushToUser } from "@/lib/push";
import { sessionMiddleware } from "@/lib/session-middleware";
import { canEditWork, canRequestChanges } from "@/features/members/permissions";
import { MemberRole } from "@/features/members/types";
import { requireMember, requireRole } from "@/features/members/utils";
import { TaskStatus } from "@/features/tasks/types";

import {
    createChangeRequestSchema,
    proposedChangesSchema,
    proposedTaskSchema,
    reviewChangeRequestSchema,
} from "../schemas";
import { ChangeRequest } from "../types";

// Enough to stop a runaway client; nobody needs more waiting at once
const MAX_PENDING_PER_MEMBER = 50;
const LIST_LIMIT = 100;
const EDITORS_ONLY = "Only admins and supervisors can review change requests";

const VERBS = { create: "add", update: "change", delete: "delete" } as const;

// People's names (or a placeholder's) by member id
const memberNames = async (ids: (string | null)[]) => {
    const wanted = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
    if (wanted.length === 0) return new Map<string, string>();
    const rows = await db
        .select({ id: members.id, placeholderName: members.placeholderName, name: users.name })
        .from(members)
        .leftJoin(users, eq(users.id, members.userId))
        .where(inArray(members.id, wanted));
    return new Map(rows.map((row) => [row.id, row.name ?? row.placeholderName ?? "Someone"]));
};

const toChangeRequest = (row: typeof changeRequests.$inferSelect, names: Map<string, string>): ChangeRequest => ({
    $id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    status: row.status,
    taskId: row.taskId,
    taskName: row.taskName,
    changes: row.changes as ChangeRequest["changes"],
    note: row.note,
    requesterId: row.requesterId,
    requesterName: names.get(row.requesterId) ?? "Someone",
    reviewerName: row.reviewerId ? names.get(row.reviewerId) ?? null : null,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
});

// In-app notification plus push, once per request event
const notify = async (userIds: string[], message: {
    workspaceId: string; taskId: string | null; kind: "change_request" | "change_reviewed";
    title: string; body: string; dedupe: string;
}) => {
    const url = `/workspaces/${message.workspaceId}/requests`;
    const created = userIds.length ? await db.insert(notifications).values(userIds.map((userId) => ({
        userId,
        workspaceId: message.workspaceId,
        taskId: message.taskId,
        kind: message.kind,
        title: message.title,
        body: message.body,
        url,
        scheduledFor: new Date(),
        dedupeKey: `${message.dedupe}:${userId}`,
    }))).onConflictDoNothing({ target: notifications.dedupeKey }).returning() : [];
    await Promise.all(created.map((notification) => pushToUser(notification.userId, [{
        title: notification.title, body: notification.body, url, tag: notification.dedupeKey,
    }]))).catch((error) => console.error("Change request push failed", error));
};

// undefined = leave unchanged, null = clear, string = set
const toStartAt = (startAt: string | null | undefined) =>
    startAt === undefined ? undefined : startAt === null ? null : new Date(startAt);

const app = new Hono()
    // Editors see every request in the workspace; everyone else sees their own
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string().min(1) })),
        async (c) => {
            const { workspaceId } = c.req.valid("query");
            const member = await requireMember(c, workspaceId);
            if (member instanceof Response) {
                return member;
            }

            const rows = await db.select().from(changeRequests)
                .where(and(
                    eq(changeRequests.workspaceId, workspaceId),
                    canEditWork(member.role) ? undefined : eq(changeRequests.requesterId, member.$id),
                ))
                .orderBy(desc(changeRequests.createdAt))
                .limit(LIST_LIMIT);

            const names = await memberNames(rows.flatMap((row) => [row.requesterId, row.reviewerId]));
            return c.json({ data: { documents: rows.map((row) => toChangeRequest(row, names)) } });
        }
    )

    .post(
        "/",
        sessionMiddleware,
        zValidator("json", createChangeRequestSchema),
        async (c) => {
            const body = c.req.valid("json");

            // The workspace comes from the task for changes to an existing one
            const task = body.kind === "create" ? null : await findById(tasks, body.taskId);
            if (body.kind !== "create" && !task) {
                return c.json({ error: "Task not found" }, 404);
            }
            const workspaceId = body.kind === "create" ? body.workspaceId : task!.workspaceId;

            const member = await requireMember(c, workspaceId);
            if (member instanceof Response) {
                return member;
            }
            if (!canRequestChanges(member.role)) {
                return c.json({ error: canEditWork(member.role)
                    ? "You can make this change yourself"
                    : "Viewers can't request changes" }, 403);
            }

            if (body.kind !== "delete") {
                const foreignReference = await findForeignReference(workspaceId, {
                    projectId: body.changes.projectId,
                    assigneeIds: body.changes.assigneeIds,
                });
                if (foreignReference) {
                    return c.json({ error: foreignReference }, 400);
                }
            }

            const [{ value: pending }] = await db.select({ value: count() }).from(changeRequests)
                .where(and(eq(changeRequests.requesterId, member.$id), eq(changeRequests.status, "pending")));
            if (pending >= MAX_PENDING_PER_MEMBER) {
                return c.json({ error: `You have ${pending} requests waiting; wait for some to be reviewed` }, 429);
            }

            const taskName = body.kind === "create" ? body.changes.name : task!.name;
            const [row] = await db.insert(changeRequests).values({
                workspaceId,
                requesterId: member.$id,
                kind: body.kind,
                taskId: task?.id ?? null,
                taskName,
                // Dates are stored as ISO strings and parsed again when applied
                changes: body.kind === "delete" ? {} : JSON.parse(JSON.stringify(body.changes)),
                note: body.note || null,
            }).returning();

            // Tell the people who can approve it
            const reviewers = await db.select({ userId: members.userId }).from(members)
                .where(and(
                    eq(members.workspaceId, workspaceId),
                    inArray(members.role, [MemberRole.ADMIN, MemberRole.SUPERVISOR]),
                    isNotNull(members.userId),
                ));
            const names = await memberNames([member.$id]);
            await notify(reviewers.map((reviewer) => reviewer.userId!), {
                workspaceId,
                taskId: row.taskId,
                kind: "change_request",
                title: `${names.get(member.$id)} wants to ${VERBS[row.kind]} "${taskName}"`,
                body: row.note ?? "Open to approve or decline",
                dedupe: `change_request:${row.id}`,
            });

            return c.json({ data: toChangeRequest(row, names) });
        }
    )

    // Applies the change and marks the request approved, together
    .post(
        "/:requestId/approve",
        sessionMiddleware,
        zValidator("json", reviewChangeRequestSchema),
        async (c) => {
            const { requestId } = c.req.param();
            const { note } = c.req.valid("json");
            const request = await findById(changeRequests, requestId);
            if (!request) {
                return c.json({ error: "Request not found" }, 404);
            }

            const member = await requireRole(c, request.workspaceId, canEditWork, EDITORS_ONLY);
            if (member instanceof Response) {
                return member;
            }
            if (request.status !== "pending") {
                return c.json({ error: `This request was already ${request.status}` }, 409);
            }
            if (request.kind !== "create" && !request.taskId) {
                return c.json({ error: "The task no longer exists; decline the request instead" }, 409);
            }

            // Checked again: the project or people may have gone since it was asked
            const parsed = request.kind === "create"
                ? proposedTaskSchema.safeParse(request.changes)
                : request.kind === "update" ? proposedChangesSchema.safeParse(request.changes) : null;
            if (parsed && !parsed.success) {
                return c.json({ error: "The request's changes are no longer valid" }, 400);
            }
            const changes = parsed?.data;
            if (changes) {
                const foreignReference = await findForeignReference(request.workspaceId, {
                    projectId: changes.projectId,
                    assigneeIds: changes.assigneeIds,
                });
                if (foreignReference) {
                    return c.json({ error: `${foreignReference}; decline the request instead` }, 400);
                }
            }

            const outcome = await db.transaction(async (tx) => {
                // Only one reviewer wins if two approve at once
                const [claimed] = await tx.update(changeRequests)
                    .set({ status: "approved", reviewerId: member.$id, reviewNote: note || null, reviewedAt: new Date() })
                    .where(and(eq(changeRequests.id, requestId), eq(changeRequests.status, "pending")))
                    .returning();
                if (!claimed) return null;

                if (request.kind === "create") {
                    const proposed = changes as z.infer<typeof proposedTaskSchema>;
                    const status = proposed.status ?? TaskStatus.TODO;
                    const [highest] = await tx.select({ position: max(tasks.position) }).from(tasks)
                        .where(and(eq(tasks.status, status), eq(tasks.projectId, proposed.projectId)));
                    const [task] = await tx.insert(tasks).values({
                        ...proposed,
                        status,
                        workspaceId: request.workspaceId,
                        assigneeIds: Array.from(new Set(proposed.assigneeIds)),
                        startAt: toStartAt(proposed.startAt),
                        position: (highest?.position ?? 0) + 1000,
                    }).returning({ id: tasks.id });
                    await tx.update(changeRequests).set({ taskId: task.id }).where(eq(changeRequests.id, requestId));
                    return { ...claimed, taskId: task.id };
                }
                if (request.kind === "update") {
                    const proposed = changes as z.infer<typeof proposedChangesSchema>;
                    const updated = await tx.update(tasks).set({
                        ...proposed,
                        assigneeIds: proposed.assigneeIds ? Array.from(new Set(proposed.assigneeIds)) : undefined,
                        startAt: toStartAt(proposed.startAt),
                    }).where(eq(tasks.id, request.taskId!)).returning({ id: tasks.id });
                    if (updated.length === 0) tx.rollback();
                    return claimed;
                }
                await tx.delete(tasks).where(eq(tasks.id, request.taskId!));
                // The row's link to the task was cleared by the delete
                return { ...claimed, taskId: null };
            }).catch((error) => {
                if (error instanceof TransactionRollbackError) return undefined;
                throw error;
            });

            if (outcome === null) {
                return c.json({ error: "Someone else already reviewed this request" }, 409);
            }
            if (outcome === undefined) {
                return c.json({ error: "The task no longer exists; decline the request instead" }, 409);
            }

            const names = await memberNames([outcome.requesterId, member.$id]);
            const [requester] = await db.select({ userId: members.userId }).from(members).where(eq(members.id, outcome.requesterId));
            if (requester?.userId) {
                await notify([requester.userId], {
                    workspaceId: outcome.workspaceId,
                    taskId: outcome.taskId,
                    kind: "change_reviewed",
                    title: `Approved: ${VERBS[outcome.kind]} "${outcome.taskName}"`,
                    body: outcome.reviewNote ?? `${names.get(member.$id)} approved your request`,
                    dedupe: `change_reviewed:${outcome.id}`,
                });
            }

            return c.json({ data: toChangeRequest(outcome, names) });
        }
    )

    .post(
        "/:requestId/decline",
        sessionMiddleware,
        zValidator("json", reviewChangeRequestSchema),
        async (c) => {
            const { requestId } = c.req.param();
            const { note } = c.req.valid("json");
            const request = await findById(changeRequests, requestId);
            if (!request) {
                return c.json({ error: "Request not found" }, 404);
            }

            const member = await requireRole(c, request.workspaceId, canEditWork, EDITORS_ONLY);
            if (member instanceof Response) {
                return member;
            }

            const [declined] = await db.update(changeRequests)
                .set({ status: "declined", reviewerId: member.$id, reviewNote: note || null, reviewedAt: new Date() })
                .where(and(eq(changeRequests.id, requestId), eq(changeRequests.status, "pending")))
                .returning();
            if (!declined) {
                return c.json({ error: "This request was already reviewed" }, 409);
            }

            const names = await memberNames([declined.requesterId, member.$id]);
            const [requester] = await db.select({ userId: members.userId }).from(members).where(eq(members.id, declined.requesterId));
            if (requester?.userId) {
                await notify([requester.userId], {
                    workspaceId: declined.workspaceId,
                    taskId: declined.taskId,
                    kind: "change_reviewed",
                    title: `Declined: ${VERBS[declined.kind]} "${declined.taskName}"`,
                    body: declined.reviewNote ?? `${names.get(member.$id)} declined your request`,
                    dedupe: `change_reviewed:${declined.id}`,
                });
            }

            return c.json({ data: toChangeRequest(declined, names) });
        }
    )

    // The requester takes back a request nobody has reviewed yet
    .delete(
        "/:requestId",
        sessionMiddleware,
        async (c) => {
            const { requestId } = c.req.param();
            const request = await findById(changeRequests, requestId);
            if (!request) {
                return c.json({ error: "Request not found" }, 404);
            }

            const member = await requireMember(c, request.workspaceId);
            if (member instanceof Response) {
                return member;
            }
            if (request.requesterId !== member.$id) {
                return c.json({ error: "Only the person who asked can withdraw a request" }, 403);
            }

            const [withdrawn] = await db.delete(changeRequests)
                .where(and(eq(changeRequests.id, requestId), eq(changeRequests.status, "pending")))
                .returning({ id: changeRequests.id });
            if (!withdrawn) {
                return c.json({ error: "This request was already reviewed" }, 409);
            }

            return c.json({ data: { $id: withdrawn.id } });
        }
    );

export default app;
