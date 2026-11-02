import "server-only";

import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, projects, tasks } from "@/lib/db/schema";
import { findById } from "@/lib/db/find-by-id";

// A task's (or routine's) project and assignees must belong to its own workspace
export const findForeignReference = async (
    workspaceId: string,
    { projectId, assigneeIds }: { projectId?: string | null; assigneeIds?: string[] },
) => {
    if (projectId) {
        const project = await findById(projects, projectId);
        if (project?.workspaceId !== workspaceId) {
            return "Project not found in the workspace";
        }
    }

    const ids = Array.from(new Set(assigneeIds ?? []));
    if (ids.length) {
        const found = await db.select({ id: members.id }).from(members)
            .where(and(eq(members.workspaceId, workspaceId), inArray(members.id, ids)));
        if (found.length !== ids.length) {
            return "Assignee not found in the workspace";
        }
    }

    return null;
};

// Tasks sharing a Kanban ordering with a new one: its project, or (personal tasks) its workspace's project-less ones
export const sameProjectTasks = (workspaceId: string, projectId: string | null | undefined) =>
    projectId ? eq(tasks.projectId, projectId) : and(isNull(tasks.projectId), eq(tasks.workspaceId, workspaceId));
