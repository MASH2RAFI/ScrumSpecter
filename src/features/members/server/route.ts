import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { db } from "@/lib/db";
import { findById } from "@/lib/db/find-by-id";
import { members, tasks, users } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import { getMember, isAdmin, requireMember } from "../utils";
import { Member, MemberRole } from "../types";

const listWorkspaceMembers = (workspaceId: string) =>
    db.select().from(members).where(eq(members.workspaceId, workspaceId));

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
                .innerJoin(users, eq(users.id, members.userId))
                .where(eq(members.workspaceId, workspaceId));

            // The list doubles as the membership check, saving a round trip
            if (!rows.some(({ member }) => member.userId === c.get("user").$id)) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const populatedMembers = rows.map(({ member, name, email }) => ({
                ...toDoc(member),
                name,
                email,
            }) as Member);

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

            if (allMembersInWorkspace.length === 1) {
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
                if (adminMember) {
                    await tx
                        .update(tasks)
                        .set({ assigneeId: adminMember.id })
                        .where(and(
                            eq(tasks.workspaceId, memberToDelete.workspaceId),
                            eq(tasks.assigneeId, memberToDelete.id),
                        ));
                }

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

            const allMembersInWorkspace = await listWorkspaceMembers(memberToUpdate.workspaceId);

            if (allMembersInWorkspace.length === 1) {
                return c.json({ error: "Cannot Downgrade the only member" }, 400);
            }

            const adminMembers = allMembersInWorkspace.filter(
                (m) => m.role === MemberRole.ADMIN
            );

            if (memberToUpdate.role === MemberRole.ADMIN && role === MemberRole.MEMBER && adminMembers.length === 1) {
                return c.json({
                    error: "Cannot downgrade the only admin. Please promote another member to admin first."
                }, 400);
            }

            await db.update(members).set({ role }).where(eq(members.id, memberId));

            return c.json({ data: { $id: memberToUpdate.id } });
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
                const reassigned = await tx
                    .update(tasks)
                    .set({ assigneeId: adminMember.id })
                    .where(and(
                        eq(tasks.workspaceId, workspaceId),
                        eq(tasks.assigneeId, member.$id),
                    ))
                    .returning({ id: tasks.id });

                await tx.delete(members).where(eq(members.id, member.$id));

                return reassigned.length;
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
