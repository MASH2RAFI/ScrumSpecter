import "server-only";

import { sql } from "drizzle-orm";
import type { Context } from "hono";

import { db } from "@/lib/db";
import { loginAttempts } from "@/lib/db/schema";

// Fixed-window counters, kept in the login_attempts table so every server copy shares them.
// Keys are "<bucket>:<id>", which never clash with sign-in's "email:" / "ip:" / "reset:" keys.
export const LIMITS = {
    signup: { max: 5, windowSeconds: 3600 }, // per IP
    join: { max: 10, windowSeconds: 900 }, // per account; guessing invite codes
    bulk: { max: 60, windowSeconds: 3600 }, // per account; checks and runs
    bulkApply: { max: 10, windowSeconds: 3600 }, // per account; each run can add 500 items
    verifyEmail: { max: 3, windowSeconds: 3600 }, // per account; "Resend email"
    export: { max: 30, windowSeconds: 3600 }, // per account; workspace script, backup and "My data" (whole-workspace reads)
    pushTest: { max: 20, windowSeconds: 3600 }, // per account; "Send a test notification" (a bell row and a push per device)
    changeRequest: { max: 5, windowSeconds: 120 }, // per member; a burst, then a cooldown
} as const;

// Counts one hit; returns the seconds to wait when over the limit, else 0
export const hit = async (bucket: keyof typeof LIMITS, id: string) => {
    const { max, windowSeconds } = LIMITS[bucket];
    const key = `${bucket}:${id}`;
    const expired = sql`${loginAttempts.windowStart} < now() - make_interval(secs => ${windowSeconds})`;
    // One statement, so concurrent requests can't both slip under the limit
    const [row] = await db.insert(loginAttempts).values({ key, failures: 1 })
        .onConflictDoUpdate({
            target: loginAttempts.key,
            set: {
                failures: sql`case when ${expired} then 1 else ${loginAttempts.failures} + 1 end`,
                windowStart: sql`case when ${expired} then now() else ${loginAttempts.windowStart} end`,
            },
        })
        .returning({
            failures: loginAttempts.failures,
            waitSeconds: sql<number>`ceil(extract(epoch from ${loginAttempts.windowStart} + make_interval(secs => ${windowSeconds}) - now()))::int`,
        });
    return row.failures > max ? Math.max(1, row.waitSeconds) : 0;
};

const waitText = (seconds: number) => seconds < 120
    ? `${seconds} second${seconds === 1 ? "" : "s"}`
    : `${Math.ceil(seconds / 60)} minutes`;

// A 429 with Retry-After, or null when the request may go ahead
export const rateLimited = async (c: Context, bucket: keyof typeof LIMITS, id: string) => {
    const wait = await hit(bucket, id);
    if (!wait) return null;
    c.header("Retry-After", String(wait));
    return c.json({ error: `Too many requests. Try again in ${waitText(wait)}.` }, 429);
};
