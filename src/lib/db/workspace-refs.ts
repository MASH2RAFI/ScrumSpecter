import "server-only";

import { members, projects } from "@/lib/db/schema";
import { findById } from "@/lib/db/find-by-id";

// A task's (or routine's) project and assignee must belong to its own workspace
export const findForeignReference = async (
    workspaceId: string,
    { projectId, assigneeId }: { projectId?: string; assigneeId?: string },
) => {
    if (projectId) {
        const project = await findById(projects, projectId);
        if (project?.workspaceId !== workspaceId) {
            return "Project not found in the workspace";
        }
    }

    if (assigneeId) {
        const assignee = await findById(members, assigneeId);
        if (assignee?.workspaceId !== workspaceId) {
            return "Assignee not found in the workspace";
        }
    }

    return null;
};
