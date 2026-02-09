/* eslint-disable @typescript-eslint/no-unused-vars */
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { getMember, isAdmin } from "@/features/members/utils";
import { DATABASE_ID, PROJECTS_ID, TASKS_ID, WORKSPACES_ID } from "@/config";
import { ID, Query } from "node-appwrite";
import { createProjectSchema, createProjectFormSchema, updateProjectSchema, updateProjectFormSchema } from "../schemas";
import { Project } from "../types";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { TaskStatus } from "@/features/tasks/types";

const app = new Hono()

    .post(
        "/",
        sessionMiddleware,
        zValidator("form", createProjectFormSchema),
            async (c) => {
                const databases = c.get("databases");
                const user = c.get("user");
                const { name, workspaceId, sprintDuration, sprintNumber, currentSprintStartDate, currentSprintEndDate } = c.req.valid("form");

                const member = await getMember({
                    databases,
                    workspaceId,
                    userId: user.$id
                });

                if (!member) {
                    return c.json({ error: "Unauthorized" }, 401);
                }

                // Check if user is admin
                const userIsAdmin = await isAdmin({
                    databases,
                    workspaceId,
                    userId: user.$id
                });

                if (!userIsAdmin) {
                    return c.json({ error: "Only admins can create projects" }, 403);
                }
                const project = await databases.createDocument(
                    DATABASE_ID,
                    PROJECTS_ID,
                    ID.unique(),
                    {
                        name,
                        workspaceId,
                        sprintDuration,
                        sprintNumber,
                        currentSprintStartDate,
                        currentSprintEndDate,
                    }
                );


                return c.json({data: project});
        }
    )

    .get(
        "/",
        sessionMiddleware,
        zValidator("query", z.object({ workspaceId: z.string() })),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { workspaceId } = c.req.valid("query");

            if (!workspaceId) {
                return c.json({ error: "Missing workspaceId" }, 400);
            }

            // First, verify that the workspace exists
            try {
                await databases.getDocument(
                    DATABASE_ID,
                    WORKSPACES_ID,
                    workspaceId
                );
            } catch {
                // If workspace doesn't exist, return empty projects list
                return c.json({ 
                    data: { 
                        documents: [], 
                        total: 0 
                    } 
                });
            }

            const member = await getMember({ 
                databases,
                workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            const projects = await databases.listDocuments<Project>(
                DATABASE_ID,
                PROJECTS_ID,
                [
                    Query.equal("workspaceId", workspaceId),
                    Query.orderDesc("$createdAt"),
                ],
            );

            return c.json({ data: projects });

        }
    )

    .get( 
        "/:projectId", 
        sessionMiddleware, 
        async (c) => {
            const user = c.get("user"); 
            const databases = c.get("databases"); 
            const { projectId } = c.req.param(); 

            const project = await databases.getDocument<Project>(
                DATABASE_ID, 
                PROJECTS_ID, 
                projectId, 
            ); 

            // Verify that the workspace still exists
            try {
                await databases.getDocument(
                    DATABASE_ID,
                    WORKSPACES_ID,
                    project.workspaceId
                );
            } catch (error) {
                // If workspace doesn't exist, return 404
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await getMember({
                databases,
                workspaceId: project.workspaceId,
                userId: user.$id,
            });
            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }
            return c.json({ data: project });
        }
    ) 

    .patch(
        "/:projectId", 
        sessionMiddleware,
        zValidator("form", updateProjectFormSchema),
        async (c) => {
            const user = c.get("user");
            const databases = c.get("databases");
            const { projectId } = c.req.param();
            const { name, sprintDuration, currentSprintStartDate, currentSprintEndDate, sprintNumber } = c.req.valid("form");

            const existingProject = await databases.getDocument<Project>(
                DATABASE_ID,
                PROJECTS_ID,
                projectId,
            );

            // Verify that the workspace still exists
            try {
                await databases.getDocument(
                    DATABASE_ID,
                    WORKSPACES_ID,
                    existingProject.workspaceId
                );
            } catch (error) {
                // If workspace doesn't exist, return 404
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await getMember({
                databases,
                workspaceId: existingProject.workspaceId,
                userId: user.$id,
            });
            
            if (!member) {
                return c.json({ error : "Unauthorized" }, 401 );
            }

            // Check if user is admin for startingSprintDate updates
            if (currentSprintStartDate !== undefined) {
                const userIsAdmin = await isAdmin({
                    databases,
                    workspaceId: existingProject.workspaceId,
                    userId: user.$id
                });

                if (!userIsAdmin) {
                    return c.json({ error: "Only admins can update the starting sprint date" }, 403);
                }
            }
            
            const project = await databases.updateDocument(
                DATABASE_ID,
                PROJECTS_ID,
                projectId,
                {
                    name,
                    sprintDuration,
                    currentSprintStartDate,
                    currentSprintEndDate,
                    sprintNumber,
                }
            );

        return c.json({ data: project });
        })

    .delete(
        "/:projectId",
        sessionMiddleware,
        async (c) => {
            const databases = c.get("databases");
            const user = c.get("user");
            const { projectId } = c.req.param();

            const existingProject = await databases.getDocument<Project>(
                DATABASE_ID,
                PROJECTS_ID,
                projectId,
            );

            // Verify that the workspace still exists
            try {
                await databases.getDocument(
                    DATABASE_ID,
                    WORKSPACES_ID,
                    existingProject.workspaceId
                );
            } catch (error) {
                // If workspace doesn't exist, return 404
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await getMember({
                databases,
                workspaceId: existingProject.workspaceId,
                userId: user.$id,
            });

            if (!member) {
                return c.json({ error: "Unauthorized" }, 401);
            }

            // Check if user is admin
            const userIsAdmin = await isAdmin({
                databases,
                workspaceId: existingProject.workspaceId,
                userId: user.$id
            });

            if (!userIsAdmin) {
                return c.json({ error: "Only admins can delete projects" }, 403);
            }

            // 1. Delete all tasks in the project
            const tasks = await databases.listDocuments(
                DATABASE_ID,
                TASKS_ID,
                [Query.equal("projectId", projectId)]
            );
            
            for (const task of tasks.documents) {
                await databases.deleteDocument(
                    DATABASE_ID,
                    TASKS_ID,
                    task.$id
                );
            }

            // 2. Delete the project itself
            await databases.deleteDocument( 
                DATABASE_ID, 
                PROJECTS_ID, 
                projectId, 
            );

            return c.json({ data: { $id: existingProject.$id } });

        }
    )

    .get( 
        "/:projectId/analytics", 
        sessionMiddleware, 
        async (c) => {
            const user = c.get("user"); 
            const databases = c.get("databases"); 
            const { projectId } = c.req.param(); 

            const project = await databases.getDocument<Project>(
                DATABASE_ID, 
                PROJECTS_ID, 
                projectId, 
            ); 

            // Verify that the workspace still exists
            try {
                await databases.getDocument(
                    DATABASE_ID,
                    WORKSPACES_ID,
                    project.workspaceId
                );
            } catch (error) {
                // If workspace doesn't exist, return 404
                return c.json({ error: "Project not found" }, 404);
            }

            const member = await getMember({
                databases,
                workspaceId: project.workspaceId,
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

            const thisMonthTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const taskCount = thisMonthTasks.total;
            const taskDifference = taskCount-lastMonthTasks.total;

            const thisMonthAssignedTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.equal("assigneeId", member.$id),
                    Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthAssignedTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.equal("assigneeId", member.$id),
                    Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const assignedTaskCount = thisMonthAssignedTasks.total;
            const assignedTaskDifference = assignedTaskCount-lastMonthAssignedTasks.total;

            const thisMonthIncompleteTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthIncompleteTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const incompleteTaskCount = thisMonthIncompleteTasks.total;
            const incompleteTaskDifference = incompleteTaskCount-lastMonthIncompleteTasks.total;

            const thisMonthCompletedTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.equal("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthCompletedTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.equal("status", TaskStatus.DONE), 
                    Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", lastMonthEnd.toISOString())
                ]
            )

            const completedTaskCount = thisMonthCompletedTasks.total;
            const completedTaskDifference = completedTaskCount-lastMonthCompletedTasks.total;

            const thisMonthOverdueTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.lessThan("dueDate", now.toISOString()),
                    Query.greaterThanEqual("$createdAt", thisMonthStart.toISOString()),
                    Query.lessThanEqual("$createdAt", thisMonthEnd.toISOString())
                ]
            )

            const lastMonthOverdueTasks = await databases.listDocuments( 
                DATABASE_ID,
                TASKS_ID,
                [
                    Query.equal("projectId", projectId),
                    Query.notEqual("status", TaskStatus.DONE), 
                    Query.lessThan("dueDate", now.toISOString()),
                    Query.greaterThanEqual("$createdAt", lastMonthStart.toISOString()),
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