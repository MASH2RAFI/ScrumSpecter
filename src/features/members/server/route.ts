import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, arrayContains, asc, eq, isNotNull } from "drizzle-orm";
import { removeAssignee } from "@/lib/db/assignees";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { assertRoom } from "@/lib/volume-caps";
import { forgetSavedFilters } from "@/lib/db/saved-filters";
import { findById } from "@/lib/db/find-by-id";
import { members, notifications, tasks, users } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { getMember, handOverPlaceholder, isAdmin, lockAdmins, requireMember } from "../utils";
import { Member, MemberRole } from "../types";
import { createPlaceholderSchema, replacePlaceholderSchema } from "../schemas";
import { idString } from "@/lib/limits";

// People only: placeholders never count towards "the only member"
const countPeople = (workspaceId: string) =>
    db.$count(members, and(eq(members.workspaceId, workspaceId), isNotNull(members.userId)));

type MemberRow = typeof members.$inferSelect;

const toMember = (member: MemberRow, name: string | null, email: string | null) => ({
    ...toDoc(member),
    name: name ?? member.placeholderName ?? "",
    email: email ?? member.placeholderEmail ?? "",
    isPlaceholder: member.userId === null,
}) as Member;


const app = new Hono()
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: idString })),
        async (c) => {
            const { workspaceId } = c.req.valid("query");

            const rows = await db
                .select({ member: members, name: users.name, email: users.email })
                .from(members)
                // Placeholders have no user
                .leftJoin(users, eq(users.id, members.userId))
                .where(eq(members.workspaceId, workspaceId))
                .orderBy(asc(members.createdAt));

            // The list doubles as the membership check, saving a round trip
            if (!rows.some(({ member }) => member.userId === c.get("user").$id)) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            // People first, then placeholders
            const populatedMembers = rows
                .map(({ member, name, email }) => toMember(member, name, email))
                .sort((a, b) => Number(a.isPlaceholder) - Number(b.isPlaceholder));

            return c.json({
                data: {
                    documents: populatedMembers,
                    total: populatedMembers.length,
                },
            });
        }
    )

    .delete(
        "/:memberId",
        sessionMiddleware,
        async (c) => {
            const { memberId } = c.req.param();

            const memberToDelete = await findById(members, memberId);

            if (!memberToDelete) {
                return c.json({ error: "Member not found" }, 404);
            }

            const member = await requireMember(c, memberToDelete.workspaceId);
            if (member instanceof Response) {
                return member;
            }

            if (member.$id !== memberToDelete.id && member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            if (memberToDelete.userId !== null && await countPeople(memberToDelete.workspaceId) === 1) {
                return c.json({ error: "Cannot delete the only member" }, 400);
            }

            const removed = await db.transaction(async (tx) => {
                const admins = await lockAdmins(tx, memberToDelete.workspaceId);
                if (admins.length === 1 && admins[0].id === memberToDelete.id) {
                    return false;
                }
                // An admin other than the deleted member takes over their tasks
                const adminMember = admins.find((m) => m.id !== memberToDelete.id);
                // Off their tasks and routines; an admin takes over where nobody else is left
                await removeAssignee(tx, memberToDelete.id, adminMember?.id ?? null);
                await tx.delete(members).where(eq(members.id, memberId));
                // Their bell must not keep naming this workspace's tasks
                if (memberToDelete.userId) {
                    await tx.delete(notifications).where(and(eq(notifications.userId, memberToDelete.userId), eq(notifications.workspaceId, memberToDelete.workspaceId)));
                    await forgetSavedFilters(tx, { workspaceId: memberToDelete.workspaceId, userId: memberToDelete.userId });
                }
                return true;
            });

            if (!removed) {
                return c.json({
                    error: "Cannot delete the only admin. Please transfer admin role to another member first."
                }, 400);
            }

            return c.json({ data: { $id: memberToDelete.id } });
        }
    )

    .patch(
        "/:memberId",
        sessionMiddleware,
        zValidator("json", z.object({ role: z.nativeEnum(MemberRole) })),
        async (c) => {
            const { memberId } = c.req.param();
            const { role } = c.req.valid("json");

            const memberToUpdate = await findById(members, memberId);

            if (!memberToUpdate) {
                return c.json({ error: "Member not found" }, 404);
            }

            const member = await requireMember(c, memberToUpdate.workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            if (memberToUpdate.userId === null) {
                return c.json({ error: "A placeholder can't be given a role" }, 400);
            }

            if (await countPeople(memberToUpdate.workspaceId) === 1) {
                return c.json({ error: "Cannot Downgrade the only member" }, 400);
            }

            const updated = await db.transaction(async (tx) => {
                const admins = await lockAdmins(tx, memberToUpdate.workspaceId);
                if (role !== MemberRole.ADMIN && admins.length === 1 && admins[0].id === memberId) {
                    return false;
                }
                await tx.update(members).set({ role }).where(eq(members.id, memberId));
                return true;
            });

            if (!updated) {
                return c.json({
                    error: "Cannot downgrade the only admin. Please promote another member to admin first."
                }, 400);
            }

            return c.json({ data: { $id: memberToUpdate.id } });
        }
    )

    // A placeholder to assign tasks to before the person joins (admins)
    .post(
        "/placeholders",
        sessionMiddleware,
        zValidator("json", createPlaceholderSchema),
        async (c) => {
            const { workspaceId, name, email } = c.req.valid("json");

            const member = await requireMember(c, workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            await assertRoom("members", workspaceId);

            const [placeholder] = await db.insert(members).values({
                workspaceId,
                userId: null,
                role: MemberRole.ASSIGNEE,
                placeholderName: name,
                placeholderEmail: email ? email.toLowerCase() : null,
            }).returning();

            return c.json({ data: toMember(placeholder, null, null) });
        }
    )

    // Hands a placeholder's tasks to someone who has joined, and removes it (admins)
    .post(
        "/:memberId/replace",
        sessionMiddleware,
        zValidator("json", replacePlaceholderSchema),
        async (c) => {
            const { memberId: placeholderId } = c.req.param();
            const { memberId } = c.req.valid("json");

            const placeholder = await findById(members, placeholderId);
            if (!placeholder || placeholder.userId !== null) {
                return c.json({ error: "Placeholder not found" }, 404);
            }

            const member = await requireMember(c, placeholder.workspaceId, { adminOnly: true });
            if (member instanceof Response) {
                return member;
            }

            const target = await findById(members, memberId);
            if (!target || target.workspaceId !== placeholder.workspaceId || target.userId === null) {
                return c.json({ error: "Pick someone who has joined this workspace" }, 400);
            }

            await handOverPlaceholder(placeholderId, memberId);
            return c.json({ data: { $id: placeholderId } });
        }
    )

    .get(
        "/is-admin",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: idString })),
        async (c) => {
            const user = c.get("user");
            const { workspaceId } = c.req.valid("query");

            const userIsAdmin = await isAdmin({
                workspaceId,
                userId: user.$id,
            });

            return c.json({ data: userIsAdmin });
        }
    )

    .post(
        "/leave-workspace",
        sessionMiddleware,
        zValidator("json", z.object({ workspaceId: idString })),
        async (c) => {
            const { workspaceId } = c.req.valid("json");
            const user = c.get("user");

            const member = await getMember({
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Not a member of this workspace" }, 400);
            }

            const outcome = await db.transaction(async (tx) => {
                const admins = await lockAdmins(tx, workspaceId);
                if (admins.length === 1 && admins[0].id === member.$id) {
                    return "only-admin" as const;
                }
                // An admin other than the leaving member takes over their tasks
                const adminMember = admins.find((m) => m.id !== member.$id);
                if (!adminMember) {
                    return "no-admin" as const;
                }

                const assigned = await tx.select({ id: tasks.id }).from(tasks)
                    .where(and(eq(tasks.workspaceId, workspaceId), arrayContains(tasks.assigneeIds, [member.$id])));
                // Off their tasks and routines; the admin takes over where nobody else is left
                await removeAssignee(tx, member.$id, adminMember.id);
                await tx.delete(members).where(eq(members.id, member.$id));
                await tx.delete(notifications).where(and(eq(notifications.userId, user.$id), eq(notifications.workspaceId, workspaceId)));
                await forgetSavedFilters(tx, { workspaceId, userId: user.$id });

                return { reassignedTasks: assigned.length, newAssignee: adminMember.userId };
            });

            if (outcome === "only-admin") {
                return c.json({
                    error: "Cannot leave workspace as the only admin. Please transfer admin role to another member first."
                }, 400);
            }
            if (outcome === "no-admin") {
                return c.json({
                    error: "No admin found to reassign tasks to"
                }, 400);
            }

            return c.json({
                data: {
                    message: "Successfully left workspace",
                    ...outcome,
                }
            });
        }
    );

export default app;
