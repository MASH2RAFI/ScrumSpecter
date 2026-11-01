import "server-only";

import { getCookie, setCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { AUTH_COOKIE } from "@/features/auth/constants";
import { getUserFromToken, SESSION_COOKIE_OPTIONS, type SessionUser } from "@/lib/auth";

export type SessionEnv = {
    Variables: {
        user: SessionUser;
        sessionToken: string;
    };
};

export const sessionMiddleware = createMiddleware<SessionEnv>(
    async (c, next) => {
        const session = getCookie(c, AUTH_COOKIE);

        if (!session) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const found = await getUserFromToken(session);

        if (!found) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        // Keep the cookie alive as long as the session (idle expiry)
        if (found.refreshed) {
            setCookie(c, AUTH_COOKIE, session, SESSION_COOKIE_OPTIONS);
        }

        c.set("user", found.user);
        c.set("sessionToken", session);

        await next();
    },
);
