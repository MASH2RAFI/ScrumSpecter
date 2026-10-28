import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, projects } from "@/lib/db/schema";
import { findById } from "@/lib/db/find-by-id";

// A task's (or routine's) project and assignees must belong to its own workspace
export const findForeignReference = async (
    workspaceId: string,
    { projectId, assigneeIds }: { projectId?: string; assigneeIds?: string[] },
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
