import { AsyncLocalStorage } from "node:async_hooks";

import type { Context } from "hono";
import { and, asc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";

import { db, type Tx } from "@/lib/db";
import { members, users } from "@/lib/db/schema";
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

const lookUpMember = async ({ workspaceId, userId }: GetMemberProps) => {
    const [member] = await db
        .select()
        .from(members)
        .where(and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)))
        .limit(1);

    return member ? toDoc(member) : undefined;
};

// Reads that arrive while the same lookup is still running share it: a page load asks "is this
// person a member here?" a dozen times at once. Only for reads (`shared`), and gone as soon as the
// lookup ends, so nothing is ever older than the request itself; a change always looks it up fresh.
const pendingMembers = new Map<string, Promise<Awaited<ReturnType<typeof lookUpMember>>>>();

// Inside one POST /api/batch (its reads run a few at a time, so they miss each other's in-flight lookups) the
// answer is kept until the batch ends: seconds at most, and only for the reads inside it
const batchMembers = new AsyncLocalStorage<Map<string, ReturnType<typeof lookUpMember>>>();
export const sharingMembers = <T>(run: () => Promise<T>) => batchMembers.run(new Map(), run);

export const getMember = (props: GetMemberProps, { shared = false } = {}) => {
    if (!shared) return lookUpMember(props);
    const key = `${props.userId}:${props.workspaceId}`;
    const inBatch = batchMembers.getStore();
    if (inBatch) {
        let lookup = inBatch.get(key);
        if (!lookup) {
            lookup = lookUpMember(props);
            inBatch.set(key, lookup);
        }
        return lookup;
    }
    let lookup = pendingMembers.get(key);
    if (!lookup) {
        lookup = lookUpMember(props).finally(() => pendingMembers.delete(key));
        pendingMembers.set(key, lookup);
    }
    return lookup;
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
    const member = await getMember({ workspaceId, userId: c.get("user").$id }, { shared: c.req.method === "GET" });

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

// A verified address takes over the placeholders made for it in the workspaces its owner joined
// (viewers can't work on tasks, so they don't). Unverified, anyone with an invite link could sign up
// with someone else's address and receive their tasks, so this also runs when an address gets verified.
export const claimPlaceholders = async (userId: string) => {
    const [user] = await db.select({ email: users.email, verifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user?.verifiedAt) return;
    const mine = await db.select({ id: members.id, workspaceId: members.workspaceId }).from(members)
        .where(and(eq(members.userId, userId), ne(members.role, MemberRole.VIEWER)));
    if (mine.length === 0) return;
    const placeholders = await db.select({ id: members.id, workspaceId: members.workspaceId }).from(members).where(and(
        inArray(members.workspaceId, mine.map((member) => member.workspaceId)),
        isNull(members.userId),
        eq(members.placeholderEmail, user.email.toLowerCase()),
    ));
    for (const placeholder of placeholders) {
        await handOverPlaceholder(placeholder.id, mine.find((member) => member.workspaceId === placeholder.workspaceId)!.id);
    }
};

// The workspace's admins (people only), locked until the transaction ends, so two admins
// demoting or removing each other at once can't leave the workspace with none
export const lockAdmins = (tx: Tx, workspaceId: string) =>
    tx.select().from(members)
        .where(and(eq(members.workspaceId, workspaceId), eq(members.role, MemberRole.ADMIN), isNotNull(members.userId)))
        // Same lock order in every transaction, so they queue instead of deadlocking
        .orderBy(asc(members.id))
        .for("update");
