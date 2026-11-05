import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, workspaces } from "@/lib/db/schema";
import { MemberRole } from "@/features/members/types";
import { toDocList } from "@/lib/db/types";

// A Viewer must not get the regular invite code: it joins as an Assignee, so a second account
// would climb past the read-only role. Everyone else sees it (members share the link).
export const forRole = <T extends { inviteCode: string }>(workspace: T, role: string | null | undefined): T =>
    role === MemberRole.VIEWER ? { ...workspace, inviteCode: "" } : workspace;

export const listUserWorkspaces = async (userId: string) => {
    const rows = await db
        .select({ workspace: workspaces, role: members.role })
        .from(workspaces)
        .innerJoin(members, eq(members.workspaceId, workspaces.id))
        .where(eq(members.userId, userId))
        .orderBy(desc(workspaces.createdAt));

    return toDocList(rows.map((row) => forRole(row.workspace, row.role)));
};
