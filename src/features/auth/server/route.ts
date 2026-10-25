import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { sessionMiddleware } from "@/lib/session-middleware";
import { createSession, deleteSession, hashPassword, SESSION_MAX_AGE, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
    createAuthorizationRequest,
    fetchGoogleProfile,
    GOOGLE_STATE_COOKIE,
    GOOGLE_VERIFIER_COOKIE,
    isGoogleAuthEnabled,
} from "@/lib/google-oauth";
import { AUTH_COOKIE } from "../constants";
import { loginSchema, registerSchema } from "../schemas";

const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    maxAge: SESSION_MAX_AGE,
} as const;

// Lax so they survive Google's cross-site redirect back to the callback
const oauthCookieOptions = {
    path: "/api/auth/google",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 60 * 10,
} as const;

// The session cookie is SameSite=Strict, so a 302 straight after Google's cross-site
// redirect would arrive without it. A same-site navigation from this page sends it.
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

            const [user] = await db
                .select()
                .from(users)
                .where(eq(users.email, email.toLowerCase()))
                .limit(1);

            // Google-only accounts have no password to check
            if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
                return c.json({ error: "Invalid credentials" }, 401);
            }

            const token = await createSession(user.id);

            setCookie(c, AUTH_COOKIE, token, cookieOptions);

            return c.json({ success: true });
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
                })
                .returning({ id: users.id });

            const token = await createSession(user.id);

            setCookie(c, AUTH_COOKIE, token, cookieOptions);

            return c.json({ success: true });
        }
    )
    .get("/google", (c) => {
        if (!isGoogleAuthEnabled()) {
            return c.redirect("/sign-in?error=google_unavailable");
        }

        const { url, state, codeVerifier } = createAuthorizationRequest();

        setCookie(c, GOOGLE_STATE_COOKIE, state, oauthCookieOptions);
        setCookie(c, GOOGLE_VERIFIER_COOKIE, codeVerifier, oauthCookieOptions);

        return c.redirect(url);
    })
    .get("/google/callback", async (c) => {
        const { code, state, error } = c.req.query();
        const expectedState = getCookie(c, GOOGLE_STATE_COOKIE);
        const codeVerifier = getCookie(c, GOOGLE_VERIFIER_COOKIE);

        deleteCookie(c, GOOGLE_STATE_COOKIE, { path: oauthCookieOptions.path, secure: true });
        deleteCookie(c, GOOGLE_VERIFIER_COOKIE, { path: oauthCookieOptions.path, secure: true });

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

        const email = profile.email.toLowerCase();

        const [byGoogleId] = await db.select().from(users).where(eq(users.googleId, profile.sub)).limit(1);
        let userId = byGoogleId?.id;

        if (!userId) {
            // Google has verified the address, so an existing account with it is safe to link
            const [byEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);

            if (byEmail) {
                await db.update(users).set({ googleId: profile.sub }).where(eq(users.id, byEmail.id));
                userId = byEmail.id;
            } else {
                const [created] = await db
                    .insert(users)
                    .values({ name: profile.name || email.split("@")[0], email, googleId: profile.sub })
                    .returning({ id: users.id });
                userId = created.id;
            }
        }

        const token = await createSession(userId);
        setCookie(c, AUTH_COOKIE, token, cookieOptions);

        return c.html(continueTo("/"));
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
