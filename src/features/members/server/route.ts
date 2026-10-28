import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, arrayContains, asc, eq, isNotNull } from "drizzle-orm";
import { removeAssignee } from "@/lib/db/assignees";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { members, tasks, users } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { getMember, handOverPlaceholder, isAdmin, requireMember } from "../utils";
import { Member, MemberRole } from "../types";
import { createPlaceholderSchema, replacePlaceholderSchema } from "../schemas";

// People only: placeholders never count towards "the only member" or "the only admin"
const listWorkspaceMembers = (workspaceId: string) =>
    db.select().from(members).where(and(eq(members.workspaceId, workspaceId), isNotNull(members.userId)));

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
        zValidator("query", z.object({ workspaceId: z.string() })),
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

            const allMembersInWorkspace = await listWorkspaceMembers(memberToDelete.workspaceId);

            if (memberToDelete.userId !== null && allMembersInWorkspace.length === 1) {
                return c.json({ error: "Cannot delete the only member" }, 400);
            }

            const adminMembers = allMembersInWorkspace.filter(
                (m) => m.role === MemberRole.ADMIN
            );

            if (memberToDelete.role === MemberRole.ADMIN && adminMembers.length === 1) {
                return c.json({
                    error: "Cannot delete the only admin. Please transfer admin role to another member first."
                }, 400);
            }

            // An admin other than the deleted member takes over their tasks
            const adminMember = adminMembers.find((m) => m.id !== memberToDelete.id);

            await db.transaction(async (tx) => {
                // Off their tasks and routines; an admin takes over where nobody else is left
                await removeAssignee(tx, memberToDelete.id, adminMember?.id ?? null);
                await tx.delete(members).where(eq(members.id, memberId));
            });

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

            const allMembersInWorkspace = await listWorkspaceMembers(memberToUpdate.workspaceId);

            if (allMembersInWorkspace.length === 1) {
                return c.json({ error: "Cannot Downgrade the only member" }, 400);
            }

            const adminMembers = allMembersInWorkspace.filter(
                (m) => m.role === MemberRole.ADMIN
            );

            if (memberToUpdate.role === MemberRole.ADMIN && role !== MemberRole.ADMIN && adminMembers.length === 1) {
                return c.json({
                    error: "Cannot downgrade the only admin. Please promote another member to admin first."
                }, 400);
            }

            await db.update(members).set({ role }).where(eq(members.id, memberId));

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
        zValidator("query", z.object({ workspaceId: z.string() })),
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
        zValidator("json", z.object({ workspaceId: z.string() })),
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

            const allMembersInWorkspace = await listWorkspaceMembers(workspaceId);

            const adminMembers = allMembersInWorkspace.filter(
                (m) => m.role === MemberRole.ADMIN
            );

            if (member.role === MemberRole.ADMIN && adminMembers.length === 1) {
                return c.json({
                    error: "Cannot leave workspace as the only admin. Please transfer admin role to another member first."
                }, 400);
            }

            // An admin other than the leaving member takes over their tasks
            const adminMember = adminMembers.find((m) => m.id !== member.$id);

            if (!adminMember) {
                return c.json({
                    error: "No admin found to reassign tasks to"
                }, 400);
            }

            const reassignedTasks = await db.transaction(async (tx) => {
                const assigned = await tx.select({ id: tasks.id }).from(tasks)
                    .where(and(eq(tasks.workspaceId, workspaceId), arrayContains(tasks.assigneeIds, [member.$id])));
                // Off their tasks and routines; the admin takes over where nobody else is left
                await removeAssignee(tx, member.$id, adminMember.id);
                await tx.delete(members).where(eq(members.id, member.$id));

                return assigned.length;
            });

            return c.json({
                data: {
                    message: "Successfully left workspace",
                    reassignedTasks,
                    newAssignee: adminMember.userId,
                }
            });
        }
    );

export default app;
