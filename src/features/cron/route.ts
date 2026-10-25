import { Hono } from "hono";
import { timingSafeEqual } from "crypto";

import { generateRoutineTasks } from "@/lib/routines";

// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET"
const isAuthorized = (header: string | undefined) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || !header) {
        return false;
    }
    const expected = Buffer.from(`Bearer ${secret}`);
    const actual = Buffer.from(header);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const app = new Hono()
    .get("/routines", async (c) => {
        if (!isAuthorized(c.req.header("authorization"))) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        const created = await generateRoutineTasks();

        return c.json({ data: { created } });
    });

export default app;
