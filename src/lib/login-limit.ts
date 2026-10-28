import "server-only";

import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 15;
// Per address, and (looser, since offices share one) per IP. Reset emails have their own count,
// so requesting resets for someone can't lock them out of signing in.
const LIMITS = { email: 10, ip: 30, reset: 5 } as const;

export type AttemptKey = { kind: keyof typeof LIMITS; value: string };

export const attemptKeys = (email: string | null | undefined, ip: string | null | undefined): AttemptKey[] => [
    ...(email ? [{ kind: "email" as const, value: email.toLowerCase() }] : []),
    ...(ip ? [{ kind: "ip" as const, value: ip }] : []),
];

const keyOf = ({ kind, value }: AttemptKey) => `${kind}:${value}`;

// Minutes until the first of these keys unlocks, or 0 when none is locked
export const lockedMinutes = async (keys: AttemptKey[], now = new Date()) => {
    if (keys.length === 0) return 0;
    const rows = await db.select({ lockedUntil: loginAttempts.lockedUntil }).from(loginAttempts)
        .where(inArray(loginAttempts.key, keys.map(keyOf)));
    const until = Math.max(0, ...rows.map((row) => row.lockedUntil?.getTime() ?? 0));
    return until > now.getTime() ? Math.ceil((until - now.getTime()) / 60_000) : 0;
};

// Counts a wrong password; enough of them within the window locks the key
export const recordFailure = async (keys: AttemptKey[], now = new Date()) => {
    if (keys.length === 0) return;
    const existing = new Map(
        (await db.select().from(loginAttempts).where(inArray(loginAttempts.key, keys.map(keyOf))))
            .map((row) => [row.key, row]),
    );

    for (const key of keys) {
        const row = existing.get(keyOf(key));
        // A new window starts once the old one is over, or a lock has run out
        const fresh = !row
            || row.windowStart.getTime() < now.getTime() - WINDOW_MINUTES * 60_000
            || (row.lockedUntil !== null && row.lockedUntil.getTime() <= now.getTime());
        const failures = fresh ? 1 : row.failures + 1;
        const lockedUntil = failures >= LIMITS[key.kind]
            ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
            : fresh ? null : row.lockedUntil;
        const values = { failures, windowStart: fresh ? now : row.windowStart, lockedUntil };

        await db.insert(loginAttempts).values({ key: keyOf(key), ...values })
            .onConflictDoUpdate({ target: loginAttempts.key, set: values });
    }
};

export const clearFailures = async (keys: AttemptKey[]) => {
    if (keys.length === 0) return;
    await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys.map(keyOf)));
};

export const resetRequestKeys = (email: string): AttemptKey[] => [{ kind: "reset", value: email.toLowerCase() }];

export const tooManyAttempts = (minutes: number) =>
    `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
