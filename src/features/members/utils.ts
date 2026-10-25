import type { Context } from "hono";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { members } from "@/lib/db/schema";
import { toDoc } from "@/lib/db/types";
import type { SessionEnv } from "@/lib/session-middleware";
import { MemberRole } from "./types";

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

    return member?.role === MemberRole.ADMIN;
};

// The current user's membership, or a 401 response to return as-is.
// With adminOnly, non-admins get the same 401.
export const requireMember = async (
    c: UserContext,
    workspaceId: string,
    { error = "Unauthorized", adminOnly = false }: { error?: string; adminOnly?: boolean } = {},
) => {
    const member = await getMember({ workspaceId, userId: c.get("user").$id });

    if (!member || (adminOnly && member.role !== MemberRole.ADMIN)) {
        return c.json({ error }, 401);
    }

    return member;
};

// Like requireMember, but non-admins get a 403 with forbiddenError
export const requireAdmin = async (
    c: UserContext,
    workspaceId: string,
    forbiddenError: string,
    unauthorizedError?: string,
) => {
    const member = await requireMember(c, workspaceId, { error: unauthorizedError });

    if (member instanceof Response || member.role === MemberRole.ADMIN) {
        return member;
    }

    return c.json({ error: forbiddenError }, 403);
};
