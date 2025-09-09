import { sessionMiddleware } from "@/lib/session-middleware";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createWorkspaceSchema, updateWorkspaceSchema } from "../schemas";
import { DATABASE_ID, MEMBERS_ID, PROJECTS_ID, TASKS_ID, WORKSPACES_ID } from "@/config";
import { ID, Query } from "node-appwrite";
import { MemberRole } from "@/features/members/types";
import { generateInviteCode } from "@/lib/utils";
import { getMember } from "@/features/members/utils";
import { z } from "zod";
import { Workspace } from "../types";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { TaskStatus } from "@/features/tasks/types";

const app = new Hono()
    .get(
        "/", 
        sessionMiddleware,
        async (c) => {
            const user = c.get("user")
            const databases = c.get("databases");

            const members = await databases.listDocuments (
                DATABASE_ID,
                MEMBERS_ID,
                [Query.equal("userId", user.$id)]
            );
            
            if (members. total === 0) {
                return c.json({ data: { documents: [], total: 0 } });
            }
            
            const workspaceIds = members.documents.map((member) => member.workspaceId);

            const workspaces = await databases.listDocuments(
                DATABASE_ID,
                WORKSPACES_ID,
                [
                    Query.orderDesc("$createdAt"),
                    Query.contains("$id", workspaceIds)
                ]
            );
        return c.json({ data: workspaces });
    })

    .post(
        "/",
        zValidator("form", createWorkspaceSchema),
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { name } = c.req.valid("form");
            const workspace = await databases.createDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                ID.unique(),
                {
                    name,
                    userId: user.$id,
                    inviteCode: generateInviteCode(6),
                }
            );

            await databases.createDocument(
                DATABASE_ID,
                MEMBERS_ID,
                ID.unique(),
                {
                    userId: user.$id,
                    workspaceId: workspace.$id,
                    role: MemberRole.ADMIN,
                },
            )

            return c.json({data: workspace});
        }

    )

    .get(
        "/:workspaceId",
        sessionMiddleware,
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId } = c.req.param();
            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });
            if (!member) { 
                return c.json({ error: "Unauthorized" }, 401);
            }
            const workspace = await databases.getDocument<Workspace>(
                DATABASE_ID, 
                WORKSPACES_ID, 
                workspaceId, 
            ); 
            return c.json({ data: workspace }); 
        }
    )
    
    .get(
        "/:workspaceId/info",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const { workspaceId } = c.req.param();
            const workspace = await databases.getDocument<Workspace>(
                DATABASE_ID, 
                WORKSPACES_ID, 
                workspaceId, 
            ); 
            return c.json({
                data:{
                    $id: workspace.$id, 
                    name: workspace.name
                }
            }); 
        }
    )    
    .patch(
        "/:workspaceId", 
        sessionMiddleware,
        zValidator("form", updateWorkspaceSchema),
        async (c) => {
            const user = c.get("user")
            const databases = c.get("databases");
            const { workspaceId } = c.req.param();
            const { name } = c.req.valid("form");

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });
            
            if (!member || member.role != MemberRole.ADMIN) {
                return c.json({ error : "Unauthorized" }, 401 );
            }
            
            const workspace = await databases.updateDocument(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId,
                {
                    name,
                }
            );

        return c.json({ data: workspace });
    })

    .delete(
        "/:workspaceId",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { workspaceId } = c.req.param();
            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member || member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            // 1. Delete all tasks in the workspace
            const tasks = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [Query.equal("workspaceId", workspaceId)]
            );
            
            for (const task of tasks.documents) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    TASKS_ID,
                    task.$id
                );
            }

            // 2. Delete all projects in the workspace
            const projects = await databases.listDocuments(
                DATABASE_ID,
                PROJECTS_ID,
                [Query.equal("workspaceId", workspaceId)]
            );
            
            for (const project of projects.documents) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    PROJECTS_ID,
                    project.$id
                );
            }

            // 3. Delete all members in the workspace
            const members = await databases.listDocuments(
                DATABASE_ID,
                MEMBERS_ID,
                [Query.equal("workspaceId", workspaceId)]
            );
            
            for (const member of members.documents) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    MEMBERS_ID,
                    member.$id
                );
            }

            // 4. Finally delete the workspace itself
            await databases.deleteDocument( 
                DATABASE_ID, 
                WORKSPACES_ID, 
                workspaceId, 
            );

            return c.json({ data: { $id: workspaceId } });

        }
    )

    .post(
        "/:workspaceId/reset-invite-code",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { workspaceId } = c.req.param();
            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member || member.role !== MemberRole.ADMIN) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const workspace = await databases.updateDocument( 
                DATABASE_ID, 
                WORKSPACES_ID, 
                workspaceId, 
                {
                    inviteCode: generateInviteCode(6),
                }
            );

            return c.json({ data: workspace });

        }
    )

    .post(
        "/:workspaceId/join",
        sessionMiddleware,
        zValidator("json", z.object({ code: z.string() })),
        async (c) => {
            const { workspaceId } = c.req.param(); 
            const { code } = c.req.valid("json");
            const databases = c.get("databases");
            const user = c.get("user");
            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (member) {
                return c.json({ error: "Already a member" }, 400);
            }

            const workspace = await databases.getDocument<Workspace>(
                DATABASE_ID,
                WORKSPACES_ID,
                workspaceId
            );

            if (workspace.inviteCode !== code) {
                return c.json({ error: "Invalid invite code" }, 400);
            }

            await databases.createDocument( 
                DATABASE_ID,
                MEMBERS_ID,
                ID.unique(),
                {
                    userId: user.$id,
                    workspaceId,
                    role: MemberRole.MEMBER,
                }
            );

            return c.json({ data: workspace });
        }
    )

    .get( 
        "/:workspaceId/analytics", 
        sessionMiddleware, 
        async (c) => {
            const user = c.get("user"); 
            const databases = c.get("databases"); 
            const { workspaceId } = c.req.param(); 

            const member = await getMember({
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const now = new Date(); 
            const thisMonthStart = startOfMonth(now); 
            const thisMonthEnd = endOfMonth(now); 
            const lastMonthStart = startOfMonth(subMonths(now, 1)); 
            const lastMonthEnd = endOfMonth(subMonths(now, 1)); 

            const thisMonthTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.greaterThanEqual("$createdAt", lastMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const taskCount = thisMonthTasks.total;
            const taskDifference = taskCount-lastMonthTasks.total;

            const thisMonthAssignedTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.equal("assigneeId", member.$id),
                    Query.greaterThanEqual("$createdAt", thisMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthAssignedTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.equal("assigneeId", member.$id),
                    Query.greaterThanEqual("$createdAt", lastMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const assignedTaskCount = thisMonthAssignedTasks.total;
            const assignedTaskDifference = assignedTaskCount-lastMonthAssignedTasks.total;

            const thisMonthIncompleteTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", thisMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthIncompleteTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", lastMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const incompleteTaskCount = thisMonthIncompleteTasks.total;
            const incompleteTaskDifference = incompleteTaskCount-lastMonthIncompleteTasks.total;

            const thisMonthCompletedTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.equal("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", thisMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthCompletedTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.equal("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", lastMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const completedTaskCount = thisMonthCompletedTasks.total;
            const completedTaskDifference = completedTaskCount-lastMonthCompletedTasks.total;

            const thisMonthOverdueTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.lessThan("dueDate", now.toISOString()),
                    Query.greaterThanEqual("$createdAt", thisMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthOverdueTasks = await databases. listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("workspaceId",  workspaceId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.lessThan("dueDate", now.toISOString()),
                    Query.greaterThanEqual("$createdAt", lastMonthStart. toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const overdueTaskCount = thisMonthOverdueTasks.total;
            const overdueTaskDifference = overdueTaskCount-lastMonthOverdueTasks.total;

            return c.json({
                data: {
                    taskCount,
                    taskDifference,
                    assignedTaskCount,
                    assignedTaskDifference,
                    completedTaskCount,
                    completedTaskDifference,
                    incompleteTaskCount,
                    incompleteTaskDifference,
                    overdueTaskCount,
                    overdueTaskDifference,
                }
            })
        }
    );
export default app;