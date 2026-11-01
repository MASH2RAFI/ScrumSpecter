import { createECDH, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { registerUser } from "./helpers";

// API: a push service that rejects the VAPID key (401/403) drops the device, and "Send a test" says so
test("push: a rejected subscription is forgotten and the test reports it as failed", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Push Polash");
    let respondWith = 201;
    const server: Server = createServer({
        key: readFileSync(join(__dirname, "fixtures/push-server.key")),
        cert: readFileSync(join(__dirname, "fixtures/push-server.crt")),
    }, (req, res) => {
        req.resume();
        req.on("end", () => {
            res.statusCode = respondWith;
            res.end();
        });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    const subscribe = async (device: string) => {
        const ecdh = createECDH("prime256v1");
        ecdh.generateKeys();
        const res = await user.api.post("/api/notifications/subscriptions", { data: {
            endpoint: `https://127.0.0.1:${port}/push/${device}`,
            keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
        } });
        expect(res.status(), await res.text()).toBe(200);
    };
    const sendTest = async () => (await (await user.api.post("/api/notifications/test")).json()).data as { pushed: number; failed: number };
    const devices = async () => (await (await user.api.get("/api/notifications/subscriptions")).json()).data.devices;

    try {
        // Nothing subscribed: neither sent nor failed
        expect(await sendTest()).toEqual({ pushed: 0, failed: 0 });

        await subscribe("desktop");
        expect(await sendTest()).toEqual({ pushed: 1, failed: 0 });

        // Subscribed with other VAPID keys: the push service refuses it
        respondWith = 403;
        expect(await sendTest()).toEqual({ pushed: 0, failed: 1 });
        expect(await devices()).toBe(0);

        respondWith = 401;
        await subscribe("desktop-again");
        expect(await sendTest()).toEqual({ pushed: 0, failed: 1 });
        expect(await devices()).toBe(0);

        // Subscribing again works once the push service accepts it
        respondWith = 201;
        await subscribe("desktop-fresh");
        expect(await sendTest()).toEqual({ pushed: 1, failed: 0 });
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});
