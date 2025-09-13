import { createAdminClient } from "@/lib/appwrite";
import { sessionMiddleware } from "@/lib/session-middleware";
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getMember, isAdmin } from "../utils";
import { DATABASE_ID, MEMBERS_ID, TASKS_ID } from "@/config";
import { Query } from "node-appwrite";
import { Member, MemberRole } from "../types";

const app = new Hono()
    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string() })),
        async ( c ) => {
            const { users } = await createAdminClient();
            const databases = c.get("databases");
            const user = c.get("user");
            const { workspaceId } = c.req.valid("query");

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Unauthorized"}, 401);
            }

            const members = await databases.listDocuments<Member>(
                DATABASE_ID,
                MEMBERS_ID,
                [Query.equal("workspaceId", workspaceId)]
            );
            
            const populatedMembers = await Promise.all(
                members.documents.map (async (member) => { 
                    const user = await users.get(member.userId); 
                    
                    return { 
                        ... member, 
                        name: user.name, 
                        email: user.email, 
                    }
                }) 
            );

            return c. json ({
                data: {
                    ...members,
                    documents: populatedMembers,
                },
            });
        }
    )
    .delete(
        "/:memberId",
        sessionMiddleware,
        async (c) =>{
            const { memberId } = c.req.param();
            const user = c.get("user");
            const databases = c.get("databases");

            const memberToDelete = await databases.getDocument(
                DATABASE_ID,
                MEMBERS_ID,
                memberId,
            );

            const allMembersInWorkspace = await databases.listDocuments(
                DATABASE_ID,
                MEMBERS_ID,
                [Query.equal("workspaceId", memberToDelete.workspaceId)]
            );

            const member = await getMember({
                databases,
                workspaceId: memberToDelete.workspaceId,
                userId: user.$id
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            if (member.$id !== memberToDelete.$id && member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            if (allMembersInWorkspace. total === 1) { 
                return c.json({ error: "Cannot delete the only member"}, 400);
            }

            // Check if trying to delete the last admin
            const adminMembers = allMembersInWorkspace.documents.filter(
                m => m.role === MemberRole.ADMIN
            );

            if (memberToDelete.role === MemberRole.ADMIN && adminMembers.length === 1) {
                return c.json({ 
                    error: "Cannot delete the only admin. Please transfer admin role to another member first." 
                }, 400);
            }

            // Find an admin to reassign tasks to
            const adminMember = allMembersInWorkspace.documents.find(
                m => m.role === MemberRole.ADMIN && m.$id !== memberToDelete.$id
            );

            if (adminMember) {
                // Get all tasks assigned to the member being deleted
                const userTasks = await databases.listDocuments(
                    DATABASE_ID,
                    TASKS_ID,
                    [
                        Query.equal("workspaceId", memberToDelete.workspaceId),
                        Query.equal("assigneeId", memberToDelete.userId)
                    ]
                );

                // Reassign all tasks to the admin
                if (userTasks.documents.length > 0) {
                    const reassignPromises = userTasks.documents.map(task =>
                        databases.updateDocument(
                            DATABASE_ID,
                            TASKS_ID,
                            task.$id,
                            {
                                assigneeId: adminMember.userId,
                            }
                        )
                    );

                    await Promise.all(reassignPromises);
                }
            }

            await databases.deleteDocument(
                DATABASE_ID, 
                MEMBERS_ID,
                memberId,
            );

            return c.json( { data: {$id: memberToDelete.$id} } );
        }
    )
    .patch( 
        "/:memberId",
        sessionMiddleware, 
        zValidator("json", z.object({ role: z.nativeEnum(MemberRole)})),
        async (c) =>{
            const { memberId } = c.req.param();
            const { role } = c.req.valid("json");
            const user = c.get("user");
            const databases = c.get("databases");

            const memberToUpdate = await databases.getDocument(
                DATABASE_ID,
                MEMBERS_ID,
                memberId,
            );

            const allMembersInWorkspace = await databases.listDocuments(
                DATABASE_ID,
                MEMBERS_ID,
                [Query.equal("workspaceId", memberToUpdate.workspaceId)]
            );

            const member = await getMember({
                databases,
                workspaceId: memberToUpdate.workspaceId,
                userId: user.$id
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            if ( member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            if (allMembersInWorkspace. total === 1) { 
                return c.json({ error: "Cannot Downgrade the only member"}, 400);
            }

            // Check if trying to downgrade the last admin
            const adminMembers = allMembersInWorkspace.documents.filter(
                m => m.role === MemberRole.ADMIN
            );

            if (memberToUpdate.role === MemberRole.ADMIN && role === MemberRole.MEMBER && adminMembers.length === 1) {
                return c.json({ 
                    error: "Cannot downgrade the only admin. Please promote another member to admin first." 
                }, 400);
            }

            await databases.updateDocument(
                DATABASE_ID, 
                MEMBERS_ID,
                memberId,
                {
                    role,
                }
            );

            return c.json( { data: { $id: memberToUpdate.$id } } );
        }
    )

    .get(
        "/is-admin",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string() })),
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { workspaceId } = c.req.valid("query");

            const userIsAdmin = await isAdmin({
                databases,
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
            const databases = c.get("databases");

            // Get the current member
            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Not a member of this workspace" }, 400);
            }

            // Check if this is the only admin
            const allMembersInWorkspace = await databases.listDocuments(
                DATABASE_ID,
                MEMBERS_ID,
                [Query.equal("workspaceId", workspaceId)]
            );

            const adminMembers = allMembersInWorkspace.documents.filter(
                m => m.role === MemberRole.ADMIN
            );

            if (member.role === MemberRole.ADMIN && adminMembers.length === 1) {
                return c.json({ 
                    error: "Cannot leave workspace as the only admin. Please transfer admin role to another member first." 
                }, 400);
            }

            // Find an admin to reassign tasks to
            // If the leaving member is not an admin, we can use any admin
            // If the leaving member is an admin, we need a different admin
            const adminMember = allMembersInWorkspace.documents.find(
                m => m.role === MemberRole.ADMIN && 
                     (member.role !== MemberRole.ADMIN || m.$id !== member.$id)
            );

            if (!adminMember) {
                return c.json({ 
                    error: "No admin found to reassign tasks to" 
                }, 400);
            }

            // Get all tasks assigned to the leaving member
            const userTasks = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.equal("assigneeId", user.$id)
                ]
            );

            // Reassign all tasks to the admin
            const reassignPromises = userTasks.documents.map(task =>
                databases.updateDocument(
                    DATABASE_ID,
                    TASKS_ID,
                    task.$id,
                    {
                        assigneeId: adminMember.userId,
                    }
                )
            );

            await Promise.all(reassignPromises);

            // Remove the member from the workspace
            await databases.deleteDocument(
                DATABASE_ID,
                MEMBERS_ID,
                member.$id
            );

            return c.json({ 
                data: { 
                    message: "Successfully left workspace",
                    reassignedTasks: userTasks.documents.length,
                    newAssignee: adminMember.userId
                } 
            });
        }
    );

export default app;