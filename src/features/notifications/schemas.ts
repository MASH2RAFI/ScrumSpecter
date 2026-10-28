import { z } from "zod";

// The browsers' push services; the server POSTs reminders to these, so nothing else is accepted
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];

const isPushServiceUrl = (value: string) => {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return false;
        // The e2e suite runs its own push service on loopback
        if (process.env.NODE_ENV !== "production" && url.hostname === "127.0.0.1") return true;
        return PUSH_HOSTS.some((host) => host.test(url.hostname));
    } catch {
        return false;
    }
};

// PushSubscription.toJSON() from the browser
export const subscriptionSchema = z.object({
    endpoint: z.string().max(2048).refine(isPushServiceUrl, "Not a push service URL"),
    keys: z.object({
        p256dh: z.string().min(1).max(256),
        auth: z.string().min(1).max(64),
    }),
});

export const markReadSchema = z.object({
    // Omitted: mark everything read
    ids: z.array(z.string()).max(100).optional(),
});
