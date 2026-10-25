import "server-only";

import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { AUTH_COOKIE } from "@/features/auth/constants";
import { getUserFromToken, type SessionUser } from "@/lib/auth";

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

        const user = await getUserFromToken(session);

        if (!user) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        c.set("user", user);
        c.set("sessionToken", session);

        await next();
    },
);
