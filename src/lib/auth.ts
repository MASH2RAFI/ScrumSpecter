import "server-only";

import { createHash, randomBytes } from "crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";

export const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type SessionUser = {
    $id: string;
    name: string;
    email: string;
};

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Every authenticated request validates its session, which costs a round trip to the Pi.
// Cache hits per instance briefly; a logout handled by another instance takes effect
// there within SESSION_CACHE_TTL.
const SESSION_CACHE_TTL = 30_000;
const SESSION_CACHE_MAX = 1_000;
const sessionCache = new Map<string, { user: SessionUser; expiresAt: number }>();

export const hashPassword = (password: string) => hash(password);

export const verifyPassword = async (passwordHash: string, password: string) => {
    try {
        return await verify(passwordHash, password);
    } catch {
        return false;
    }
};

export const createSession = async (userId: string) => {
    const token = randomBytes(32).toString("base64url");

    await db.insert(sessions).values({
        id: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
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
        .select({ $id: users.id, name: users.name, email: users.email, sessionExpiresAt: sessions.expiresAt })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
        .limit(1);

    if (!row) {
        sessionCache.delete(id);
        return null;
    }

    const { sessionExpiresAt, ...user } = row;

    if (sessionCache.size >= SESSION_CACHE_MAX) {
        sessionCache.clear();
    }
    sessionCache.set(id, {
        user,
        expiresAt: Math.min(Date.now() + SESSION_CACHE_TTL, sessionExpiresAt.getTime()),
    });

    return user;
};

export const deleteSession = async (token: string) => {
    const id = hashToken(token);
    sessionCache.delete(id);
    await db.delete(sessions).where(eq(sessions.id, id));
};
