import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createSession, deleteSession, deviceFromHeaders, forgetCachedSessions, getUserFromToken, hashPassword, SESSION_MAX_AGE, sessionIdFromToken, verifyPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { attemptKeys, clearFailures, lockedMinutes, recordFailure, resetRequestKeys, tooManyAttempts } from "@/lib/login-limit";
import { PENDING_GOOGLE_COOKIE, PENDING_GOOGLE_MAX_AGE, readPendingLink, signPendingLink } from "@/lib/pending-google-link";
import { safeNextPath } from "@/lib/safe-next";
import { db } from "@/lib/db";
import { passwordResets, sessions, users } from "@/lib/db/schema";
import {
    createAuthorizationRequest,
    fetchGoogleProfile,
    GOOGLE_STATE_COOKIE,
    GOOGLE_VERIFIER_COOKIE,
    isGoogleAuthEnabled,
} from "@/lib/google-oauth";
import { AUTH_COOKIE } from "../constants";
import { loginSchema, registerSchema } from "../schemas";

// Lax: a link opened from email or chat arrives signed in. Cross-site POST/PATCH/DELETE still
// go without the cookie, and every change in the API uses one of those.
const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: SESSION_MAX_AGE,
} as const;

// Holds a Google sign-in waiting for the matching account's password (see pending-google-link.ts)
const pendingGoogleCookieOptions = {
    path: "/api/auth",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: PENDING_GOOGLE_MAX_AGE,
} as const;

// Where to return after a Google sign-in (?next= on /api/auth/google)
const GOOGLE_NEXT_COOKIE = "google-oauth-next";

const RESET_TOKEN_MINUTES = 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Lax so they survive Google's cross-site redirect back to the callback
const oauthCookieOptions = {
    path: "/api/auth/google",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 10,
} as const;

// Set when a signed-in user links Google from account settings: "<session id>|<return path>".
// The session id is the stored hash, not the cookie token, so it can't be used to sign in.
const GOOGLE_LINK_COOKIE = "google-oauth-link";

const safeReturnPath = (path: string | undefined) =>
    path && (path === "/account" || /^\/workspaces\/[\w-]+(\/[\w/-]*)?$/.test(path)) ? path : "/account";

// Finishes the Google callback with a same-site navigation (older sessions used a Strict cookie,
// which a redirect straight after Google's cross-site one wouldn't carry)
const continueTo = (path: string) =>
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${path}">` +
    `<script>location.replace(${JSON.stringify(path)})</script>`;

const app = new Hono()
    .get(
        "/current",
        sessionMiddleware,
        (c) => {
            const user = c.get("user");
            return c.json({ user });
        }
    )

    .post(
        "/login",
        zValidator("json", loginSchema),
        async (c) => {
            const { email, password } = c.req.valid("json");
            const device = deviceFromHeaders((name) => c.req.header(name));
            const keys = attemptKeys(email, device.ipAddress);

            // Checked before the password, so a locked account doesn't reveal whether a guess was right
            const locked = await lockedMinutes(keys);
            if (locked) {
                return c.json({ error: tooManyAttempts(locked) }, 429);
            }

            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, email.toLowerCase()))
                .limit(1);

            // Google-only accounts have no password to check
            if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
                await recordFailure(keys);
                return c.json({ error: "Invalid credentials" }, 401);
            }
            await clearFailures(keys.filter((key) => key.kind === "email"));

            // Signing in with the password proves the account's owner: finish a waiting Google link
            const pending = readPendingLink(getCookie(c, PENDING_GOOGLE_COOKIE));
            if (pending && pending.email === user.email && !user.googleId) {
                const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.googleId, pending.sub)).limit(1);
                if (!owner) {
                    await db.update(users).set({ googleId: pending.sub }).where(eq(users.id, user.id));
                }
            }
            if (pending) {
                deleteCookie(c, PENDING_GOOGLE_COOKIE, { path: pendingGoogleCookieOptions.path, secure: true });
            }

            const token = await createSession(user.id, device);

            setCookie(c, AUTH_COOKIE, token, cookieOptions);

            return c.json({ success: true, googleLinked: Boolean(pending && pending.email === user.email) });
        }
    )
    .post(
        "/register",
        zValidator("json", registerSchema),
        async (c) => {
            const { name, email, password } = c.req.valid("json");

            const [existing] = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, email.toLowerCase()))
                .limit(1);

            if (existing) {
                return c.json({ error: "A user with this email already exists" }, 409);
            }

            const [user] = await db
                .insert(users)
                .values({
                    name,
                    email: email.toLowerCase(),
                    passwordHash: await hashPassword(password),
                    preferences: { showTutorial: true },
                })
                .returning({ id: users.id });

            const token = await createSession(user.id, deviceFromHeaders((name) => c.req.header(name)));

            setCookie(c, AUTH_COOKIE, token, cookieOptions);

            return c.json({ success: true });
        }
    )
    .get("/google", async (c) => {
        if (!isGoogleAuthEnabled()) {
            return c.redirect("/sign-in?error=google_unavailable");
        }

        const { url, state, codeVerifier } = createAuthorizationRequest();

        setCookie(c, GOOGLE_STATE_COOKIE, state, oauthCookieOptions);
        setCookie(c, GOOGLE_VERIFIER_COOKIE, codeVerifier, oauthCookieOptions);

        // Linking from account settings: remember who asked (this request is same-site,
        // so the Strict session cookie is here; the callback won't have it)
        const next = safeNextPath(c.req.query("next"));
        if (next) {
            setCookie(c, GOOGLE_NEXT_COOKIE, next, oauthCookieOptions);
        } else {
            deleteCookie(c, GOOGLE_NEXT_COOKIE, { path: oauthCookieOptions.path, secure: true });
        }

        const sessionToken = getCookie(c, AUTH_COOKIE);
        if (c.req.query("link") === "1" && sessionToken && await getUserFromToken(sessionToken)) {
            const returnTo = safeReturnPath(c.req.query("returnTo"));
            setCookie(c, GOOGLE_LINK_COOKIE, `${sessionIdFromToken(sessionToken)}|${returnTo}`, oauthCookieOptions);
        } else {
            deleteCookie(c, GOOGLE_LINK_COOKIE, { path: oauthCookieOptions.path, secure: true });
        }

        return c.redirect(url);
    })
    .get("/google/callback", async (c) => {
        const { code, state, error } = c.req.query();
        const expectedState = getCookie(c, GOOGLE_STATE_COOKIE);
        const codeVerifier = getCookie(c, GOOGLE_VERIFIER_COOKIE);
        const link = getCookie(c, GOOGLE_LINK_COOKIE);
        const next = safeNextPath(getCookie(c, GOOGLE_NEXT_COOKIE)) ?? "/";
        deleteCookie(c, GOOGLE_NEXT_COOKIE, { path: oauthCookieOptions.path, secure: true });

        deleteCookie(c, GOOGLE_STATE_COOKIE, { path: oauthCookieOptions.path, secure: true });
        deleteCookie(c, GOOGLE_VERIFIER_COOKIE, { path: oauthCookieOptions.path, secure: true });
        deleteCookie(c, GOOGLE_LINK_COOKIE, { path: oauthCookieOptions.path, secure: true });

        if (error) {
            return c.html(continueTo("/sign-in?error=google_cancelled"));
        }

        if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
            return c.html(continueTo("/sign-in?error=google_failed"));
        }

        let profile;
        try {
            profile = await fetchGoogleProfile(code, codeVerifier);
        } catch (e) {
            console.error(e);
            return c.html(continueTo("/sign-in?error=google_failed"));
        }

        if (!profile.email_verified) {
            return c.html(continueTo("/sign-in?error=google_unverified"));
        }

        if (link) {
            const [sessionId, returnTo] = link.split("|");
            const back = (result: string) => c.html(continueTo(`${safeReturnPath(returnTo)}?tab=security&google=${result}`));
            const [session] = await db.select({ userId: sessions.userId }).from(sessions)
                .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date()))).limit(1);
            if (!session) {
                return c.html(continueTo("/sign-in"));
            }
            const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.googleId, profile.sub)).limit(1);
            if (owner && owner.id !== session.userId) {
                return back("in_use");
            }
            await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, session.userId));
            return back("linked");
        }

        const email = profile.email.toLowerCase();

        const [byGoogleId] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
        let userId = byGoogleId?.id;

        if (!userId) {
            const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);

            if (byEmail) {
                // Emails aren't verified at sign-up, so whoever registered this address may not own
                // it. Link only after the account's password is entered (finished in /login).
                setCookie(c, PENDING_GOOGLE_COOKIE, signPendingLink(profile.sub, email), pendingGoogleCookieOptions);
                const params = new URLSearchParams({ link: "google", email, ...(next !== "/" ? { next } : {}) });
                return c.html(continueTo(`/sign-in?${params}`));
            } else {
                const [created] = await db
                    .insert(users)
                    .values({ name: profile.name || email.split("@")[0], email, googleId: profile.sub, preferences: { showTutorial: true } })
                    .returning({ id: users.id });
                userId = created.id;
            }
        }

        const token = await createSession(userId, deviceFromHeaders((name) => c.req.header(name)));
        setCookie(c, AUTH_COOKIE, token, cookieOptions);

        return c.html(continueTo(next));
    })
    // Emails a single-use reset link. The answer is the same whether or not the address has an
    // account, so it can't be used to find out who is registered.
    .post("/forgot-password", zValidator("json", z.object({ email: z.string().email() })), async (c) => {
        const email = c.req.valid("json").email.toLowerCase();
        const keys = resetRequestKeys(email);
        const answer = { message: "If an account exists for that email, we've sent a link to reset the password." };

        const locked = await lockedMinutes(keys);
        if (locked) {
            return c.json({ error: tooManyAttempts(locked) }, 429);
        }
        // Each request counts, so the inbox can't be flooded
        await recordFailure(keys);

        const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
        if (user) {
            const token = randomBytes(32).toString("base64url");
            await db.insert(passwordResets).values({
                id: hashToken(token),
                userId: user.id,
                expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
            });
            const link = `${process.env.NEXT_PUBLIC_APP_URL ?? new URL(c.req.url).origin}/reset-password?token=${token}`;
            await sendEmail({
                to: email,
                subject: "Reset your ScrumSpecter password",
                text: `Someone asked to reset the password for your ScrumSpecter account.\n\n` +
                    `Choose a new password here (the link works once, for ${RESET_TOKEN_MINUTES} minutes):\n${link}\n\n` +
                    `If it wasn't you, ignore this email; your password stays the same.`,
            });
        }

        return c.json({ data: answer });
    })

    .post(
        "/reset-password",
        zValidator("json", z.object({ token: z.string().min(20).max(200), password: registerSchema.shape.password })),
        async (c) => {
            const { token, password } = c.req.valid("json");
            const id = hashToken(token);

            // Claims the token in the same statement that checks it, so it can only be used once
            const [reset] = await db.update(passwordResets)
                .set({ usedAt: new Date() })
                .where(and(eq(passwordResets.id, id), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
                .returning({ userId: passwordResets.userId });
            if (!reset) {
                return c.json({ error: "This reset link is invalid or has expired. Ask for a new one." }, 400);
            }

            const [user] = await db.update(users)
                .set({ passwordHash: await hashPassword(password) })
                .where(eq(users.id, reset.userId))
                .returning({ id: users.id, email: users.email });

            // Everyone signed in with the old password is signed out
            await db.delete(sessions).where(eq(sessions.userId, user.id));
            forgetCachedSessions(user.id);
            await clearFailures(attemptKeys(user.email, null));

            const sessionToken = await createSession(user.id, deviceFromHeaders((name) => c.req.header(name)));
            setCookie(c, AUTH_COOKIE, sessionToken, cookieOptions);

            return c.json({ success: true });
        }
    )

    .post(
        "/logout",
        sessionMiddleware,
        async (c) => {
            const token = c.get("sessionToken");

            deleteCookie(c, AUTH_COOKIE, { path: cookieOptions.path, secure: cookieOptions.secure });
            await deleteSession(token);
            return c.json({ success: true });
        }
    );

export default app;
