import "server-only";

import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";

export type PushMessage = { title: string; body: string; url?: string | null; tag?: string };

let configured: boolean | undefined;

// VAPID keys identify this server to the browsers' push services
const isConfigured = () => {
    if (configured === undefined) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        configured = Boolean(publicKey && privateKey);
        if (configured) {
            webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@scrumspecter.app", publicKey!, privateKey!);
        }
    }
    return configured;
};

// Sends each message to every device the user turned notifications on for. Devices the push
// service reports as gone (404/410) are forgotten. Returns how many deliveries succeeded.
export const pushToUser = async (userId: string, messages: PushMessage[]) => {
    if (!isConfigured() || messages.length === 0) return 0;

    const subscriptions = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    const gone: string[] = [];
    const delivered: string[] = [];

    await Promise.all(subscriptions.flatMap((subscription) => messages.map(async (message) => {
        try {
            await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                JSON.stringify(message),
                // A reminder that arrives hours late is noise
                { TTL: 60 * 60, urgency: "high" },
            );
            delivered.push(subscription.id);
        } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
                gone.push(subscription.id);
            } else {
                console.error("Push failed", status, (error as Error).message);
            }
        }
    })));

    if (gone.length) {
        await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
    }
    if (delivered.length) {
        await db.update(pushSubscriptions).set({ lastUsedAt: new Date() })
            .where(inArray(pushSubscriptions.id, Array.from(new Set(delivered))));
    }
    return delivered.length;
};
