import { Query } from "node-appwrite";

import { DATABASE_ID, PROJECTS_ID } from "@/config";
import { createSessionClient } from "@/lib/appwrite";

export const getProjects = async ({ workspaceId }: { workspaceId: string }) => {
    const { databases } = await createSessionClient();
    
    const projects = await databases.listDocuments(
        DATABASE_ID,
        PROJECTS_ID,
        [
            Query.equal("workspaceId", workspaceId),
            Query.orderDesc("$createdAt")
        ]
    );

    return projects;
};
