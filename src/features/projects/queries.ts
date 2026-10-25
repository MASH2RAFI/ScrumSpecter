import { desc, eq } from "drizzle-orm";

import { getCurrent } from "@/features/auth/queries";
import { getMember } from "@/features/members/utils";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { toDocList } from "@/lib/db/types";

export const getProjects = async ({ workspaceId }: { workspaceId: string }) => {
    const user = await getCurrent();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Non-members see nothing, as with the old Appwrite document permissions
    if (!(await getMember({ workspaceId, userId: user.$id }))) {
        return toDocList([] as (typeof projects.$inferSelect)[]);
    }

    const rows = await db
        .select()
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId))
        .orderBy(desc(projects.createdAt));

    return toDocList(rows);
};
