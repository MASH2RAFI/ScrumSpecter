import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, workspaces } from "@/lib/db/schema";
import { toDocList } from "@/lib/db/types";

export const listUserWorkspaces = async (userId: string) => {
    const rows = await db
        .select({ workspace: workspaces })
        .from(workspaces)
        .innerJoin(members, eq(members.workspaceId, workspaces.id))
        .where(eq(members.userId, userId))
        .orderBy(desc(workspaces.createdAt));

    return toDocList(rows.map((row) => row.workspace));
};
