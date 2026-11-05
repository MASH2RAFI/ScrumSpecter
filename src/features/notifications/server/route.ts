import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { notifications, pushSubscriptions } from "@/lib/db/schema";
import { pushToUser } from "@/lib/push";
import { rateLimited } from "@/lib/rate-limit";
import { sessionMiddleware } from "@/lib/session-middleware";

import { markReadSchema, MAX_PUSH_DEVICES, subscriptionSchema } from "../schemas";

const LIST_LIMIT = 30;

const toNotification = (row: typeof notifications.$inferSelect) => ({
    $id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    url: row.url,
    taskId: row.taskId,
    workspaceId: row.workspaceId,
    createdAt: row.createdAt.toISOString(),
    read: row.readAt !== null,
});

const app = new Hono()
    .get("/", sessionMiddleware, async (c) => {
        const userId = c.get("user").$id;
        const [rows, [{ value: unread }]] = await Promise.all([
            db.select().from(notifications).where(eq(notifications.userId, userId))
                .orderBy(desc(notifications.createdAt)).limit(LIST_LIMIT),
            db.select({ value: count() }).from(notifications)
                .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
        ]);

        return c.json({ data: { documents: rows.map(toNotification), unread } });
    })

    .post("/read", sessionMiddleware, zValidator("json", markReadSchema), async (c) => {
        const userId = c.get("user").$id;
        const { ids } = c.req.valid("json");

        // Scoped to the signed-in user, so other people's ids are simply ignored
        await db.update(notifications).set({ readAt: new Date() }).where(and(
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
            ids ? inArray(notifications.id, ids) : undefined,
        ));

        return c.json({ data: { success: true } });
    })

    // The account's devices (at most MAX_PUSH_DEVICES), newest first. `endpoint` is the person's own
    // device address, sent so a device can tell which entry it is itself.
    .get("/subscriptions", sessionMiddleware, async (c) => {
        const items = await db.select({
            id: pushSubscriptions.id,
            endpoint: pushSubscriptions.endpoint,
            userAgent: pushSubscriptions.userAgent,
            createdAt: pushSubscriptions.createdAt,
            lastUsedAt: pushSubscriptions.lastUsedAt,
        }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, c.get("user").$id)).orderBy(desc(pushSubscriptions.createdAt));
        return c.json({ data: { devices: items.length, items } });
    })

    .post("/subscriptions", sessionMiddleware, zValidator("json", subscriptionSchema), async (c) => {
        const userId = c.get("user").$id;
        const { endpoint, keys } = c.req.valid("json");
        const userAgent = c.req.header("user-agent")?.slice(0, 300) ?? null;

        // At most MAX_PUSH_DEVICES per account: every reminder is sent to each of them, and the
        // address only has to look like a push service's, so there is no other limit on how many
        // someone could add. A device already on this account can always renew.
        const [known] = await db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).limit(1);
        if (known?.userId !== userId) {
            const [{ value: devices }] = await db.select({ value: count() }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
            if (devices >= MAX_PUSH_DEVICES) {
                return c.json({ error: `You can turn notifications on for at most ${MAX_PUSH_DEVICES} devices. Turn them off on one you no longer use, or press "Send a test" in Account settings: it removes devices that no longer exist.` }, 400);
            }
        }

        // An endpoint belongs to one browser; if someone else signs in there, it follows them
        await db.insert(pushSubscriptions)
            .values({ userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent })
            .onConflictDoUpdate({
                target: pushSubscriptions.endpoint,
                set: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent },
            });

        return c.json({ data: { success: true } });
    })

    .delete("/subscriptions", sessionMiddleware, zValidator("json", z.object({ endpoint: z.string().max(2048) })), async (c) => {
        await db.delete(pushSubscriptions).where(and(
            eq(pushSubscriptions.userId, c.get("user").$id),
            eq(pushSubscriptions.endpoint, c.req.valid("json").endpoint),
        ));
        return c.json({ data: { success: true } });
    })

    // Removes one of the account's devices (one that is gone, or another browser's)
    .delete("/subscriptions/:id", sessionMiddleware, async (c) => {
        await db.delete(pushSubscriptions).where(and(
            eq(pushSubscriptions.userId, c.get("user").$id),
            eq(pushSubscriptions.id, c.req.param("id")),
        ));
        return c.json({ data: { success: true } });
    })

    // "Send a test notification" in Account settings: also lands in the bell
    .post("/test", sessionMiddleware, async (c) => {
        const userId = c.get("user").$id;
        const limited = await rateLimited(c, "pushTest", userId);
        if (limited) return limited;

        const now = new Date();
        const [row] = await db.insert(notifications).values({
            userId,
            kind: "test",
            title: "Notifications are working",
            body: "You'll get task reminders here.",
            scheduledFor: now,
            dedupeKey: `test:${userId}:${now.getTime()}`,
        }).returning();

        const { delivered, failed } = await pushToUser(userId, [{ title: row.title, body: row.body, tag: row.dedupeKey }]);
        return c.json({ data: { pushed: delivered, failed } });
    });

export default app;
