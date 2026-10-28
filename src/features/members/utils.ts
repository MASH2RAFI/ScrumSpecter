import type { Context } from "hono";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { replaceAssignee } from "@/lib/db/assignees";
import { toDoc } from "@/lib/db/types";
import type { SessionEnv } from "@/lib/session-middleware";
import { MemberRole } from "./types";
import { canManageWorkspace } from "./permissions";

interface GetMemberProps {
    workspaceId: string;
    userId: string;
};

// Any route context behind sessionMiddleware
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UserContext = Context<SessionEnv, any, any>;

export const getMember = async ({
    workspaceId,
    userId,
}: GetMemberProps) => {
    const [member] = await db
        .select()
        .from(members)
        .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
        .limit(1);

    return member ? toDoc(member) : undefined;
};

export const isAdmin = async (props: GetMemberProps) => {
    const member = await getMember(props);

    return canManageWorkspace(member?.role);
};

// The current user's membership, or a 401 response to return as-is.
// With adminOnly (managing the workspace), anyone else gets the same 401.
export const requireMember = async (
    c: UserContext,
    workspaceId: string,
    { error = "Unauthorized", adminOnly = false }: { error?: string; adminOnly?: boolean } = {},
) => {
    const member = await getMember({ workspaceId, userId: c.get("user").$id });

    if (!member || (adminOnly && !canManageWorkspace(member.role))) {
        return c.json({ error }, 401);
    }

    return member;
};

// Like requireMember, but a member whose role fails `allowed` gets a 403 with forbiddenError
export const requireRole = async (
    c: UserContext,
    workspaceId: string,
    allowed: (role: MemberRole) => boolean,
    forbiddenError: string,
    unauthorizedError?: string,
) => {
    const member = await requireMember(c, workspaceId, { error: unauthorizedError });

    if (member instanceof Response || allowed(member.role)) {
        return member;
    }

    return c.json({ error: forbiddenError }, 403);
};

// Admins only, with a 403 for other members
export const requireAdmin = (c: UserContext, workspaceId: string, forbiddenError: string, unauthorizedError?: string) =>
    requireRole(c, workspaceId, canManageWorkspace, forbiddenError, unauthorizedError);

// Moves a placeholder's tasks and routines to a real member, then removes the placeholder
export const handOverPlaceholder = async (placeholderId: string, memberId: string) => {
    await db.transaction(async (tx) => {
        await replaceAssignee(tx, placeholderId, memberId);
        await tx.delete(members).where(and(eq(members.id, placeholderId), isNull(members.userId)));
    });
};
