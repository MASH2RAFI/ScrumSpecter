import "server-only";

import { inArray, sql } from "drizzle-orm";

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

const timestamp = (date: Date) => sql`${date.toISOString()}::timestamptz`;

// Counts this attempt BEFORE the password is checked, in one statement, so a burst of parallel
// guesses can't all be checked before the first count lands. Returns the minutes to wait when
// any key is over its limit, else 0. A correct password gives the attempt back (`succeeded`).
export const reserveAttempt = async (keys: AttemptKey[], now = new Date()) => {
    let wait = 0;
    for (const key of keys) {
        const max = LIMITS[key.kind];
        const at = timestamp(now);
        const lockEnd = timestamp(new Date(now.getTime() + LOCK_MINUTES * 60_000));
        // A new window starts once the old one is over, or a lock has run out
        const fresh = sql`(${loginAttempts.windowStart} < ${at} - make_interval(mins => ${WINDOW_MINUTES}) or ${loginAttempts.lockedUntil} <= ${at})`;
        const count = sql`case when ${fresh} then 1 else ${loginAttempts.failures} + 1 end`;
        const kept = sql`case when ${fresh} then null else ${loginAttempts.lockedUntil} end`;
        const [row] = await db.insert(loginAttempts)
            .values({ key: keyOf(key), failures: 1, windowStart: now })
            .onConflictDoUpdate({
                target: loginAttempts.key,
                set: {
                    failures: count,
                    windowStart: sql`case when ${fresh} then ${at} else ${loginAttempts.windowStart} end`,
                    lockedUntil: sql`case when ${count} >= ${max} then coalesce(${kept}, ${lockEnd}) else ${kept} end`,
                },
            })
            .returning({ failures: loginAttempts.failures, lockedUntil: loginAttempts.lockedUntil });
        if (row.failures > max && row.lockedUntil) {
            wait = Math.max(wait, Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 60_000));
        }
    }
    return wait;
};

export const clearFailures = async (keys: AttemptKey[]) => {
    if (keys.length === 0) return;
    await db.delete(loginAttempts).where(inArray(loginAttempts.key, keys.map(keyOf)));
};

// A correct password: the address starts over, and the shared IP gets its attempt back (offices
// sign in from one address, only wrong guesses should count against it)
export const succeeded = async (keys: AttemptKey[]) => {
    await clearFailures(keys.filter((key) => key.kind !== "ip"));
    const ips = keys.filter((key) => key.kind === "ip");
    if (ips.length === 0) return;
    await db.update(loginAttempts)
        .set({ failures: sql`greatest(${loginAttempts.failures} - 1, 0)` })
        .where(inArray(loginAttempts.key, ips.map(keyOf)));
};

export const resetRequestKeys = (email: string): AttemptKey[] => [{ kind: "reset", value: email.toLowerCase() }];

export const tooManyAttempts = (minutes: number) =>
    `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
