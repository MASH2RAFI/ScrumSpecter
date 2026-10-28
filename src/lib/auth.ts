import "server-only";

import { createHash, randomBytes } from "crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { resolvePreferences, type UserPreferences } from "@/features/auth/preferences";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
    $id: string;
    name: string;
    email: string;
    preferences: UserPreferences;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Every authenticated request validates its session, which costs a round trip to the Pi.
// Cache hits per instance briefly; a logout handled by another instance takes effect
// there within SESSION_CACHE_TTL.
const SESSION_CACHE_TTL = 30_000;
const SESSION_CACHE_MAX = 1_000;
const sessionCache = new Map<string, { user: SessionUser; expiresAt: number }>();
const LAST_SEEN_INTERVAL = 5 * 60_000;

export const hashPassword = (password: string) => hash(password);

export const verifyPassword = async (passwordHash: string, password: string) => {
    try {
        return await verify(passwordHash, password);
    } catch {
        return false;
    }
};

export type SessionDevice = { userAgent?: string | null; ipAddress?: string | null; location?: string | null };

// What a sign-in request says about the device, for the signed-in devices list. On Vercel the
// client IP and an approximate location come in its own headers.
export const deviceFromHeaders = (header: (name: string) => string | undefined): SessionDevice => {
    const ip = (header("x-real-ip") ?? header("x-forwarded-for")?.split(",")[0])?.trim() || null;
    const city = header("x-vercel-ip-city");
    const country = header("x-vercel-ip-country");
    let location: string | null = null;
    try {
        location = [city && decodeURIComponent(city), country].filter(Boolean).join(", ") || null;
    } catch {
        location = country ?? null;
    }
    return { userAgent: header("user-agent")?.slice(0, 400) ?? null, ipAddress: ip?.slice(0, 64) ?? null, location };
};

export const createSession = async (userId: string, device: SessionDevice = {}) => {
    const token = randomBytes(32).toString("base64url");

    await db.insert(sessions).values({
        id: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
        ...device,
        lastSeenAt: new Date(),
    });

    return token;
};

export const getUserFromToken = async (token: string): Promise<SessionUser | null> => {
    const id = hashToken(token);
    const cached = sessionCache.get(id);

    if (cached && cached.expiresAt > Date.now()) {
        return cached.user;
    }

    const [row] = await db
        .select({ $id: users.id, name: users.name, email: users.email, preferences: users.preferences, sessionExpiresAt: sessions.expiresAt, lastSeenAt: sessions.lastSeenAt })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
        .limit(1);

    if (!row) {
        sessionCache.delete(id);
        return null;
    }

    const { sessionExpiresAt, lastSeenAt, preferences, ...rest } = row;

    // "Last active" for the devices list; written at most every few minutes, and never awaited
    if (!lastSeenAt || Date.now() - lastSeenAt.getTime() > LAST_SEEN_INTERVAL) {
        db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id)).catch(() => {});
    }
    const user = { ...rest, preferences: resolvePreferences(preferences) };

    if (sessionCache.size >= SESSION_CACHE_MAX) {
        sessionCache.clear();
    }
    sessionCache.set(id, {
        user,
        expiresAt: Math.min(Date.now() + SESSION_CACHE_TTL, sessionExpiresAt.getTime()),
    });

    return user;
};

export const sessionIdFromToken = hashToken;

// After a profile change or a sign-out elsewhere, drop this instance's cached copies
export const forgetCachedSessions = (userId: string, keepSessionId?: string) => {
    for (const [id, entry] of Array.from(sessionCache.entries())) {
        if (entry.user.$id === userId && id !== keepSessionId) sessionCache.delete(id);
    }
};

// A single device signed out from another one
export const forgetCachedSession = (sessionId: string) => {
    sessionCache.delete(sessionId);
};

export const updateCachedUser = (userId: string, changes: Partial<SessionUser>) => {
    for (const entry of Array.from(sessionCache.values())) {
        if (entry.user.$id === userId) entry.user = { ...entry.user, ...changes };
    }
};

export const deleteSession = async (token: string) => {
    const id = hashToken(token);
    sessionCache.delete(id);
    await db.delete(sessions).where(eq(sessions.id, id));
};
