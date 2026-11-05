import "server-only";

import { and, isNull, lt, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { emailVerifications, loginAttempts, notifications, passwordResets, sessions } from "@/lib/db/schema";

const DAY = 24 * 60 * 60_000;

// Rows that stopped mattering, removed by the daily cron so these tables don't grow for ever
// (the sign-in lockout and rate limits add a row per address tried, whoever tries it).
// Reminders are looked up only 15 minutes back, so old notifications can go safely.
export const deleteStaleRows = async () => {
    const now = new Date();
    const ago = (days: number) => new Date(now.getTime() - days * DAY);

    const [expiredSessions, counters, oldNotifications, resets, verifications] = await Promise.all([
        db.delete(sessions).where(lt(sessions.expiresAt, now)).returning({ id: sessions.id }),
        db.delete(loginAttempts)
            .where(and(lt(loginAttempts.windowStart, ago(1)), or(isNull(loginAttempts.lockedUntil), lt(loginAttempts.lockedUntil, now))))
            .returning({ key: loginAttempts.key }),
        db.delete(notifications).where(lt(notifications.createdAt, ago(90))).returning({ id: notifications.id }),
        db.delete(passwordResets).where(lt(passwordResets.expiresAt, ago(7))).returning({ id: passwordResets.id }),
        db.delete(emailVerifications).where(lt(emailVerifications.expiresAt, ago(7))).returning({ id: emailVerifications.id }),
    ]);

    return {
        sessions: expiredSessions.length,
        loginAttempts: counters.length,
        notifications: oldNotifications.length,
        passwordResets: resets.length,
        emailVerifications: verifications.length,
    };
};
