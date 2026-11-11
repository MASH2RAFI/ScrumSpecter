import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createHash, randomBytes } from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createSession, deleteSession, deviceFromHeaders, forgetCachedSessions, getUserFromToken, hashPassword, mergePreferences, SECURE_COOKIES, SESSION_COOKIE_OPTIONS, sessionIdFromToken, verifyPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { attemptKeys, clearFailures, reserveAttempt, resetRequestKeys, succeeded, tooManyAttempts } from "@/lib/login-limit";
import { PENDING_GOOGLE_COOKIE, PENDING_GOOGLE_MAX_AGE, readPendingLink, signPendingLink } from "@/lib/pending-google-link";
import { continuePage, safeNextPath } from "@/lib/safe-next";
import { db } from "@/lib/db";
import { emailVerifications, passwordResets, sessions, users } from "@/lib/db/schema";
import {
    createAuthorizationRequest,
    fetchGoogleProfile,
    GOOGLE_STATE_COOKIE,
    GOOGLE_VERIFIER_COOKIE,
    isGoogleAuthEnabled,
} from "@/lib/google-oauth";
import { AUTH_COOKIE, LAST_WORKSPACE_COOKIE } from "../constants";
import { loginSchema, registerSchema } from "../schemas";
import { rateLimited } from "@/lib/rate-limit";
import { claimPlaceholders } from "@/features/members/utils";
import { homePath } from "@/features/workspaces/home-path";
import { resolvePreferences } from "../preferences";

// Lax: a link opened from email or chat arrives signed in. Cross-site POST/PATCH/DELETE still
// go without the cookie, and every change in the API uses one of those.
const cookieOptions = SESSION_COOKIE_OPTIONS;

// Holds a Google sign-in waiting for the matching account's password (see pending-google-link.ts)
const pendingGoogleCookieOptions = {
    path: "/api/auth",
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "Lax",
    maxAge: PENDING_GOOGLE_MAX_AGE,
} as const;

// Where to return after a Google sign-in (?next= on /api/auth/google)
const GOOGLE_NEXT_COOKIE = "google-oauth-next";

const RESET_TOKEN_MINUTES = 30;
const VERIFY_TOKEN_HOURS = 48;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const appOrigin = (url: string) => process.env.NEXT_PUBLIC_APP_URL || new URL(url).origin;

// Emails a single-use "verify your email" link. Never throws: a mail outage mustn't fail sign-up.
const sendVerificationEmail = async (userId: string, email: string, origin: string) => {
    try {
        const token = randomBytes(32).toString("base64url");
        await db.insert(emailVerifications).values({
            id: hashToken(token),
            userId,
            expiresAt: new Date(Date.now() + VERIFY_TOKEN_HOURS * 3_600_000),
        });
        await sendEmail({
            to: email,
            subject: "Verify your ScrumSpecter email",
            text: `Welcome to ScrumSpecter! Confirm this is your email address here (the link works once, for ${VERIFY_TOKEN_HOURS} hours):\n` +
                `${origin}/verify-email?token=${token}\n\n` +
                `If you didn't sign up, ignore this email.`,
        });
    } catch (e) {
        console.error("Verification email failed", e);
    }
};

// Lax so they survive Google's cross-site redirect back to the callback
const oauthCookieOptions = {
    path: "/api/auth/google",
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "Lax",
    maxAge: 60 * 10,
} as const;

// Set when a signed-in user links Google from account settings: "<session id>|<return path>".
// The session id is the stored hash, not the cookie token, so it can't be used to sign in.
const GOOGLE_LINK_COOKIE = "google-oauth-link";

const safeReturnPath = (path: string | undefined) =>
    path && (path === "/account" || /^\/workspaces\/[\w-]+(\/[\w/-]*)?$/.test(path)) ? path : "/account";

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

            // Counted before the password is checked, so a locked account doesn't reveal whether a
            // guess was right and parallel guesses can't all get through. The account is looked up
            // meanwhile (the answer isn't used until the count is in).
            const [locked, [user]] = await Promise.all([
                reserveAttempt(keys),
                db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1),
            ]);
            if (locked) {
                return c.json({ error: tooManyAttempts(locked) }, 429);
            }

            // Google-only accounts have no password to check
            if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
                return c.json({ error: "Invalid credentials" }, 401);
            }

            // Signing in with the password proves the account's owner: finish a waiting Google link
            const pending = readPendingLink(getCookie(c, PENDING_GOOGLE_COOKIE));
            if (pending && pending.email === user.email && !user.googleId) {
                const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.googleId, pending.sub)).limit(1);
                if (!owner) {
                    // Google vouched for this address, so it's verified too
                    await db.update(users).set({ googleId: pending.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() }).where(eq(users.id, user.id));
                    await claimPlaceholders(user.id);
                }
            }
            if (pending) {
                deleteCookie(c, PENDING_GOOGLE_COOKIE, { path: pendingGoogleCookieOptions.path, secure: SECURE_COOKIES });
            }

            // Independent of each other, so together: clearing the counters, the session, and where
            // this person lands (handed to the browser, which goes there directly and starts that
            // page's data on the way)
            const preferences = resolvePreferences(user.preferences);
            const [, token, home] = await Promise.all([
                succeeded(keys),
                createSession(user.id, device),
                homePath(user.id, getCookie(c, LAST_WORKSPACE_COOKIE), preferences.landingPage).catch(() => null),
            ]);

            setCookie(c, AUTH_COOKIE, token, cookieOptions);

            return c.json({
                success: true,
                googleLinked: Boolean(pending && pending.email === user.email),
                home: home?.path ?? null,
                workspaceId: home?.workspaceId ?? null,
                // Only what the browser needs to ask for that page's data (see sign-in in use-login.ts)
                preferences: { weekStart: preferences.weekStart, taskFilters: preferences.taskFilters, hiddenProjects: preferences.hiddenProjects },
            });
        }
    )
    .post(
        "/register",
        zValidator("json", registerSchema),
        async (c) => {
            const { name, email, password } = c.req.valid("json");

            // x-real-ip is set by Vercel (absent in local dev), so it can't be forged per request
            const ip = c.req.header("x-real-ip");
            const limited = ip ? await rateLimited(c, "signup", ip.slice(0, 64)) : null;
            if (limited) return limited;

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
                // A double click sends two sign-ups at once: the second loses to the unique email
                .onConflictDoNothing()
                .returning({ id: users.id });

            if (!user) {
                return c.json({ error: "A user with this email already exists" }, 409);
            }

            const [, token] = await Promise.all([
                sendVerificationEmail(user.id, email.toLowerCase(), appOrigin(c.req.url)),
                createSession(user.id, deviceFromHeaders((name) => c.req.header(name))),
            ]);

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
            deleteCookie(c, GOOGLE_NEXT_COOKIE, { path: oauthCookieOptions.path, secure: SECURE_COOKIES });
        }

        const sessionToken = getCookie(c, AUTH_COOKIE);
        if (c.req.query("link") === "1" && sessionToken && await getUserFromToken(sessionToken)) {
            const returnTo = safeReturnPath(c.req.query("returnTo"));
            setCookie(c, GOOGLE_LINK_COOKIE, `${sessionIdFromToken(sessionToken)}|${returnTo}`, oauthCookieOptions);
        } else {
            deleteCookie(c, GOOGLE_LINK_COOKIE, { path: oauthCookieOptions.path, secure: SECURE_COOKIES });
        }

        return c.redirect(url);
    })
    .get("/google/callback", async (c) => {
        const { code, state, error } = c.req.query();
        const expectedState = getCookie(c, GOOGLE_STATE_COOKIE);
        const codeVerifier = getCookie(c, GOOGLE_VERIFIER_COOKIE);
        const link = getCookie(c, GOOGLE_LINK_COOKIE);
        const next = safeNextPath(getCookie(c, GOOGLE_NEXT_COOKIE)) ?? "/";
        deleteCookie(c, GOOGLE_NEXT_COOKIE, { path: oauthCookieOptions.path, secure: SECURE_COOKIES });

        deleteCookie(c, GOOGLE_STATE_COOKIE, { path: oauthCookieOptions.path, secure: SECURE_COOKIES });
        deleteCookie(c, GOOGLE_VERIFIER_COOKIE, { path: oauthCookieOptions.path, secure: SECURE_COOKIES });
        deleteCookie(c, GOOGLE_LINK_COOKIE, { path: oauthCookieOptions.path, secure: SECURE_COOKIES });

        if (error) {
            return continuePage(c, "/sign-in?error=google_cancelled");
        }

        if (!code || !state || !expectedState || !codeVerifier || state !== expectedState) {
            return continuePage(c, "/sign-in?error=google_failed");
        }

        let profile;
        try {
            profile = await fetchGoogleProfile(code, codeVerifier);
        } catch (e) {
            console.error(e);
            return continuePage(c, "/sign-in?error=google_failed");
        }

        if (!profile.email_verified) {
            return continuePage(c, "/sign-in?error=google_unverified");
        }

        if (link) {
            const [sessionId, returnTo] = link.split("|");
            const back = (result: string) => continuePage(c, `${safeReturnPath(returnTo)}?tab=security&google=${result}`);
            const [session] = await db.select({ userId: sessions.userId }).from(sessions)
                .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date()))).limit(1);
            if (!session) {
                return continuePage(c, "/sign-in");
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
                return continuePage(c, `/sign-in?${params}`);
            } else {
                const [created] = await db
                    .insert(users)
                    .values({ name: profile.name || email.split("@")[0], email, googleId: profile.sub, emailVerifiedAt: new Date(), preferences: { showTutorial: true } })
                    .returning({ id: users.id });
                userId = created.id;
            }
        }

        const token = await createSession(userId, deviceFromHeaders((name) => c.req.header(name)));
        setCookie(c, AUTH_COOKIE, token, cookieOptions);

        return continuePage(c, next);
    })
    // Emails a single-use reset link. The answer is the same whether or not the address has an
    // account, so it can't be used to find out who is registered.
    .post("/forgot-password", zValidator("json", z.object({ email: registerSchema.shape.email })), async (c) => {
        const email = c.req.valid("json").email.toLowerCase();
        const keys = resetRequestKeys(email);
        const answer = { message: "If an account exists for that email, we've sent a link to reset the password." };

        // Each request counts, so the inbox can't be flooded
        const locked = await reserveAttempt(keys);
        if (locked) {
            return c.json({ error: tooManyAttempts(locked) }, 429);
        }

        // The lookup, the token and the mail happen after the answer, and a mail outage is only logged:
        // otherwise an address with an account answers slower (or with a 500), which tells.
        const origin = appOrigin(c.req.url);
        after(async () => {
            try {
                const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
                if (!user) return;
                const token = randomBytes(32).toString("base64url");
                await db.insert(passwordResets).values({
                    id: hashToken(token),
                    userId: user.id,
                    expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
                });
                const link = `${origin}/reset-password?token=${token}`;
                await sendEmail({
                    to: email,
                    subject: "Reset your ScrumSpecter password",
                    text: `Someone asked to reset the password for your ScrumSpecter account.\n\n` +
                        `Choose a new password here (the link works once, for ${RESET_TOKEN_MINUTES} minutes):\n${link}\n\n` +
                        `If it wasn't you, ignore this email; your password stays the same.`,
                });
            } catch (e) {
                console.error("Password reset email failed", e);
            }
        });

        return c.json({ data: answer });
    })

    .post(
        "/reset-password",
        zValidator("json", z.object({ token: z.string().min(20).max(200), password: registerSchema.shape.password })),
        async (c) => {
            const { token, password } = c.req.valid("json");
            const id = hashToken(token);

            // Claims the token in the same statement that checks it, so it can only be used once. In
            // one transaction with the new password: if saving fails, the link is not used up.
            const passwordHash = await hashPassword(password);
            const user = await db.transaction(async (tx) => {
                const [reset] = await tx.update(passwordResets)
                    .set({ usedAt: new Date() })
                    .where(and(eq(passwordResets.id, id), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
                    .returning({ userId: passwordResets.userId });
                if (!reset) return null;
                const [updated] = await tx.update(users)
                    // The emailed link proves the inbox, so it verifies the address too
                    .set({ passwordHash: passwordHash, emailVerifiedAt: sql`coalesce(${users.emailVerifiedAt}, now())` })
                    .where(eq(users.id, reset.userId))
                    .returning({ id: users.id, email: users.email });
                return updated;
            });
            if (!user) {
                return c.json({ error: "This reset link is invalid or has expired. Ask for a new one." }, 400);
            }

            await claimPlaceholders(user.id);

            // The secret calendar link works without signing in, so it can't survive a recovery
            // (an empty key means "no link"; the next "Subscribe" makes a new one)
            await mergePreferences(user.id, { calendarFeedKey: "" });

            // Everyone signed in with the old password is signed out
            await db.delete(sessions).where(eq(sessions.userId, user.id));
            forgetCachedSessions(user.id);
            await clearFailures(attemptKeys(user.email, null));

            const sessionToken = await createSession(user.id, deviceFromHeaders((name) => c.req.header(name)));
            setCookie(c, AUTH_COOKIE, sessionToken, cookieOptions);

            return c.json({ success: true });
        }
    )

    // Whether the signed-in account's email is verified (unverified accounts see a note to resend)
    .get("/email-verification", sessionMiddleware, async (c) => {
        const [user] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users)
            .where(eq(users.id, c.get("user").$id)).limit(1);
        return c.json({ data: { verified: Boolean(user?.emailVerifiedAt) } });
    })
    .post("/email-verification/resend", sessionMiddleware, async (c) => {
        const { $id, email } = c.get("user");
        const limited = await rateLimited(c, "verifyEmail", $id);
        if (limited) return limited;

        const [user] = await db.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, $id)).limit(1);
        if (!user?.emailVerifiedAt) {
            await sendVerificationEmail($id, email, appOrigin(c.req.url));
        }
        return c.json({ data: { verified: Boolean(user?.emailVerifiedAt) } });
    })
    // Opened from the emailed link; no session needed (it may be another device)
    .post("/verify-email", zValidator("json", z.object({ token: z.string().min(20).max(200) })), async (c) => {
        const { token } = c.req.valid("json");
        // Claims the token in the same statement that checks it, so it can only be used once
        const [claimed] = await db.update(emailVerifications)
            .set({ usedAt: new Date() })
            .where(and(eq(emailVerifications.id, hashToken(token)), isNull(emailVerifications.usedAt), gt(emailVerifications.expiresAt, new Date())))
            .returning({ userId: emailVerifications.userId });
        if (!claimed) {
            return c.json({ error: "This link is invalid or has expired. Sign in and ask for a new one." }, 400);
        }
        await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, claimed.userId));
        await claimPlaceholders(claimed.userId);
        return c.json({ success: true });
    })

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
