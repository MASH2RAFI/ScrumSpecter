import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

// A Google sign-in for an email that already has a password account isn't linked straight away
// (anyone could have registered that address). The Google identity waits in a signed cookie until
// the account's password is entered.

export const PENDING_GOOGLE_COOKIE = "google-pending-link";
export const PENDING_GOOGLE_MAX_AGE = 15 * 60;

type Pending = { sub: string; email: string; exp: number };

const secret = () => process.env.AUTH_LINK_SECRET || process.env.CRON_SECRET || "";

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export const signPendingLink = (sub: string, email: string) => {
    const payload = Buffer.from(JSON.stringify({ sub, email, exp: Date.now() + PENDING_GOOGLE_MAX_AGE * 1000 })).toString("base64url");
    return `${payload}.${sign(payload)}`;
};

export const readPendingLink = (value: string | undefined): Pending | null => {
    if (!value || !secret()) return null;
    const [payload, signature] = value.split(".");
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    try {
        const pending = JSON.parse(Buffer.from(payload, "base64url").toString()) as Pending;
        return pending.exp > Date.now() ? pending : null;
    } catch {
        return null;
    }
};
