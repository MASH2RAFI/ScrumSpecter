import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie } from "hono/cookie";
import { and, count, desc, eq, gt, inArray, isNotNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { members, sessions, users, workspaces } from "@/lib/db/schema";
import { removeAssignee } from "@/lib/db/assignees";
import {
    forgetCachedSession,
    forgetCachedSessions,
    hashPassword,
    sessionIdFromToken,
    updateCachedUser,
    verifyPassword,
} from "@/lib/auth";
import { isGoogleAuthEnabled } from "@/lib/google-oauth";
import { attemptKeys, lockedMinutes, recordFailure, tooManyAttempts } from "@/lib/login-limit";
import { sessionMiddleware } from "@/lib/session-middleware";
import { AUTH_COOKIE } from "@/features/auth/constants";
import { resolvePreferences } from "@/features/auth/preferences";
import { MemberRole } from "@/features/members/types";

import { deleteAccountSchema, passwordSchema, preferencesUpdateSchema, profileSchema } from "../schemas";

const findUser = async (userId: string) => {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user;
};

const app = new Hono()
    .get("/", sessionMiddleware, async (c) => {
        const { $id } = c.get("user");
        const [user, [{ value: activeSessions }]] = await Promise.all([
            findUser($id),
            db.select({ value: count() }).from(sessions).where(and(eq(sessions.userId, $id), gt(sessions.expiresAt, new Date()))),
        ]);

        return c.json({
            data: {
                name: user.name,
                email: user.email,
                hasPassword: Boolean(user.passwordHash),
                googleLinked: Boolean(user.googleId),
                googleEnabled: isGoogleAuthEnabled(),
                activeSessions,
                preferences: resolvePreferences(user.preferences),
            },
        });
    })

    .patch("/profile", sessionMiddleware, zValidator("json", profileSchema), async (c) => {
        const { $id } = c.get("user");
        const { name, currentPassword } = c.req.valid("json");
        const email = c.req.valid("json").email?.toLowerCase();
        const user = await findUser($id);

        const emailChanged = email !== undefined && email !== user.email;
        if (emailChanged) {
            if (!user.passwordHash) {
                return c.json({ error: "Set a password before changing your email" }, 400);
            }
            if (!currentPassword || !(await verifyPassword(user.passwordHash, currentPassword))) {
                return c.json({ error: "Current password is incorrect" }, 400);
            }
            const [taken] = await db.select({ id: users.id }).from(users).where(and(eq(users.email, email), ne(users.id, $id))).limit(1);
            if (taken) {
                return c.json({ error: "That email is already used by another account" }, 400);
            }
        }

        const changes = { name, email: emailChanged ? email : undefined };
        if (changes.name === undefined && changes.email === undefined) {
            return c.json({ data: { name: user.name, email: user.email } });
        }

        const [updated] = await db.update(users).set(changes).where(eq(users.id, $id))
            .returning({ name: users.name, email: users.email });
        updateCachedUser($id, updated);

        return c.json({ data: updated });
    })

    .post("/password", sessionMiddleware, zValidator("json", passwordSchema), async (c) => {
        const { $id } = c.get("user");
        const { currentPassword, newPassword } = c.req.valid("json");
        const user = await findUser($id);

        // Same lockout as sign-in, so a stolen session can't be used to guess the password
        const keys = attemptKeys(user.email, null);
        const locked = await lockedMinutes(keys);
        if (locked) {
            return c.json({ error: tooManyAttempts(locked) }, 429);
        }
        if (user.passwordHash && (!currentPassword || !(await verifyPassword(user.passwordHash, currentPassword)))) {
            await recordFailure(keys);
            return c.json({ error: "Current password is incorrect" }, 400);
        }

        await db.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, $id));

        // Anyone signed in with the old password is signed out
        const current = sessionIdFromToken(c.get("sessionToken"));
        await db.delete(sessions).where(and(eq(sessions.userId, $id), ne(sessions.id, current)));
        forgetCachedSessions($id, current);

        return c.json({ data: { success: true } });
    })

    // Every device signed in to this account, newest activity first
    .get("/sessions", sessionMiddleware, async (c) => {
        const { $id } = c.get("user");
        const current = sessionIdFromToken(c.get("sessionToken"));
        const rows = await db
            .select({
                id: sessions.id,
                userAgent: sessions.userAgent,
                ipAddress: sessions.ipAddress,
                location: sessions.location,
                createdAt: sessions.createdAt,
                lastSeenAt: sessions.lastSeenAt,
            })
            .from(sessions)
            .where(and(eq(sessions.userId, $id), gt(sessions.expiresAt, new Date())))
            .orderBy(desc(sessions.lastSeenAt));

        return c.json({
            data: rows.map((row) => ({
                // The stored hash of the session token: it identifies the session, but can't be
                // used to sign in (the cookie holds the token itself)
                id: row.id,
                userAgent: row.userAgent,
                ipAddress: row.ipAddress,
                location: row.location,
                createdAt: row.createdAt.toISOString(),
                lastSeenAt: (row.lastSeenAt ?? row.createdAt).toISOString(),
                current: row.id === current,
            })),
        });
    })

    // Sign out one other device
    .delete("/sessions/:sessionId", sessionMiddleware, async (c) => {
        const { $id } = c.get("user");
        const { sessionId } = c.req.param();

        if (sessionId === sessionIdFromToken(c.get("sessionToken"))) {
            return c.json({ error: "That's this device. Use Log out instead." }, 400);
        }

        const removed = await db.delete(sessions)
            .where(and(eq(sessions.id, sessionId), eq(sessions.userId, $id)))
            .returning({ id: sessions.id });
        if (removed.length === 0) {
            return c.json({ error: "Device not found" }, 404);
        }
        forgetCachedSession(sessionId);

        return c.json({ data: { success: true } });
    })

    .post("/sessions/revoke-others", sessionMiddleware, async (c) => {
        const { $id } = c.get("user");
        const current = sessionIdFromToken(c.get("sessionToken"));
        const revoked = await db.delete(sessions).where(and(eq(sessions.userId, $id), ne(sessions.id, current)))
            .returning({ id: sessions.id });
        forgetCachedSessions($id, current);

        return c.json({ data: { revoked: revoked.length } });
    })

    .delete("/google", sessionMiddleware, async (c) => {
        const { $id } = c.get("user");
        const user = await findUser($id);

        if (!user.passwordHash) {
            return c.json({ error: "Set a password first, or you won't be able to sign in" }, 400);
        }

        await db.update(users).set({ googleId: null }).where(eq(users.id, $id));
        return c.json({ data: { success: true } });
    })

    .patch("/preferences", sessionMiddleware, zValidator("json", preferencesUpdateSchema), async (c) => {
        const { $id } = c.get("user");
        const user = await findUser($id);
        const preferences = resolvePreferences({ ...resolvePreferences(user.preferences), ...c.req.valid("json") });

        await db.update(users).set({ preferences }).where(eq(users.id, $id));
        updateCachedUser($id, { preferences });

        return c.json({ data: preferences });
    })

    .delete("/", sessionMiddleware, zValidator("json", deleteAccountSchema), async (c) => {
        const { $id } = c.get("user");
        const { confirmEmail, password } = c.req.valid("json");
        const user = await findUser($id);

        if (confirmEmail.toLowerCase() !== user.email) {
            return c.json({ error: "Type your email to confirm" }, 400);
        }
        if (user.passwordHash && (!password || !(await verifyPassword(user.passwordHash, password)))) {
            return c.json({ error: "Password is incorrect" }, 400);
        }

        // Every workspace the user is in, with all of its members
        const memberships = await db.select().from(members).where(eq(members.userId, $id));
        const workspaceIds = memberships.map((m) => m.workspaceId);
        const everyone = workspaceIds.length
            ? await db.select().from(members).where(and(inArray(members.workspaceId, workspaceIds), isNotNull(members.userId)))
            : [];

        const blocked: string[] = [];
        const solo: string[] = [];
        const handOver: { memberId: string; adminId: string }[] = [];

        for (const membership of memberships) {
            const others = everyone.filter((m) => m.workspaceId === membership.workspaceId && m.userId !== $id);
            const otherAdmin = others.find((m) => m.role === MemberRole.ADMIN);
            if (others.length === 0) {
                solo.push(membership.workspaceId);
            } else if (!otherAdmin) {
                blocked.push(membership.workspaceId);
            } else {
                handOver.push({ memberId: membership.id, adminId: otherAdmin.id });
            }
        }

        if (blocked.length) {
            const names = await db.select({ name: workspaces.name }).from(workspaces).where(inArray(workspaces.id, blocked));
            return c.json({
                error: `Make someone else an admin of ${names.map((w) => w.name).join(", ")} first`,
            }, 400);
        }

        await db.transaction(async (tx) => {
            // Shared workspaces keep the user's work, handed to another admin
            for (const { memberId, adminId } of handOver) {
                await removeAssignee(tx, memberId, adminId);
            }
            if (solo.length) {
                await tx.delete(workspaces).where(inArray(workspaces.id, solo));
            }
            // Memberships and sessions go with the user (ON DELETE CASCADE)
            await tx.delete(users).where(eq(users.id, $id));
        });
        forgetCachedSessions($id);

        deleteCookie(c, AUTH_COOKIE, { path: "/", secure: true });
        return c.json({ data: { success: true } });
    });

export default app;
