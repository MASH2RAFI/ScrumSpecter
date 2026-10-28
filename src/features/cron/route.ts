import { Hono } from "hono";
import { timingSafeEqual } from "crypto";

import { generateRoutineTasks } from "@/lib/routines";
import { runReminders } from "@/lib/reminders";
import { moveOverdueToBacklog } from "@/lib/overdue";

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
    })
    // Called every 5 minutes by the Pi's crontab (Vercel's free cron is daily only): sends due
    // reminders, then moves tasks still in To Do after they ended to Backlog
    .get("/reminders", async (c) => {
        if (!isAuthorized(c.req.header("authorization"))) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        // Tests simulate the clock; production always uses the real time
        const simulated = process.env.NODE_ENV !== "production" ? c.req.query("now") : undefined;
        const now = simulated ? new Date(simulated) : new Date();
        if (Number.isNaN(now.getTime())) {
            return c.json({ error: "Invalid now" }, 400);
        }

        // Reminders first: a task ending now still gets its "ends in 30 min" before it moves
        const reminders = await runReminders(now);
        const movedToBacklog = await moveOverdueToBacklog(now);

        return c.json({ data: { ...reminders, movedToBacklog } });
    });

export default app;
