import { createECDH, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import { registerUser } from "./helpers";

// API: a push service that rejects the VAPID key (401/403) drops the device, and "Send a test" says so
test("push: a rejected subscription is forgotten and the test reports it as failed", async ({ baseURL }) => {
    test.skip(!!process.env.E2E_PROD, "the local fake push service is allowed only outside production (notifications/schemas.ts)");
    const user = await registerUser(baseURL!, "Push Polash");
    let respondWith = 201;
    // The next requests the push service fails on its own side (503), whatever respondWith says
    let failNext = 0;
    const server: Server = createServer({
        key: readFileSync(join(__dirname, "fixtures/push-server.key")),
        cert: readFileSync(join(__dirname, "fixtures/push-server.crt")),
    }, (req, res) => {
        req.resume();
        req.on("end", () => {
            res.statusCode = failNext > 0 ? (failNext--, 503) : respondWith;
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

        // The push service fails once on its side: tried again, delivered (a reminder is recorded
        // before it is pushed, so nothing else would send it)
        failNext = 1;
        expect(await sendTest()).toEqual({ pushed: 1, failed: 0 });
        // Failing twice is a failure, but not a reason to forget the device
        failNext = 2;
        expect(await sendTest()).toEqual({ pushed: 0, failed: 1 });
        expect(await devices()).toBe(1);
    } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
});

// "Send a test notification" adds a bell row and a push per device each time: 20 an hour, then a wait
test("push: the test notification is limited per account", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Test Tess");
    for (let i = 0; i < 20; i++) expect((await user.api.post("/api/notifications/test")).status()).toBe(200);
    const limited = await user.api.post("/api/notifications/test");
    expect(limited.status()).toBe(429);
    expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
});

// Every reminder goes to each device, and any address that looks like a push service's is accepted
test("push: an account can turn notifications on for at most 10 devices", async ({ baseURL }) => {
    test.skip(!!process.env.E2E_PROD, "the local fake push service is allowed only outside production (notifications/schemas.ts)");
    const user = await registerUser(baseURL!, "Many Mo");
    const subscribe = (n: number) => user.api.post("/api/notifications/subscriptions", { data: {
        endpoint: `https://127.0.0.1:1/push/device-${n}`, keys: { p256dh: "p256dh-key", auth: "auth-key" },
    } });
    const devices = async () => (await (await user.api.get("/api/notifications/subscriptions")).json()).data.devices as number;

    for (let n = 1; n <= 10; n++) expect((await subscribe(n)).status()).toBe(200);
    const eleventh = await subscribe(11);
    expect(eleventh.status()).toBe(400);
    expect((await eleventh.json()).error).toMatch(/at most 10 devices.*Send a test/);
    expect(await devices()).toBe(10);
    // A device already on the account renews without counting twice
    expect((await subscribe(3)).status()).toBe(200);
    expect(await devices()).toBe(10);
    // Turning one off makes room
    expect((await user.api.delete("/api/notifications/subscriptions", { data: { endpoint: "https://127.0.0.1:1/push/device-1" } })).status()).toBe(200);
    expect((await subscribe(11)).status()).toBe(200);
    expect(await devices()).toBe(10);
});

// Devices that are gone can be removed one by one, and only from the account's own list
test("push: the device list shows the account's devices and removes one by id", async ({ baseURL }) => {
    test.skip(!!process.env.E2E_PROD, "the local fake push service is allowed only outside production (notifications/schemas.ts)");
    const user = await registerUser(baseURL!, "List Lou");
    const other = await registerUser(baseURL!, "List Other");
    const subscribe = (who: typeof user, n: number) => who.api.post("/api/notifications/subscriptions", { data: {
        endpoint: `https://127.0.0.1:1/push/list-${who.name}-${n}`, keys: { p256dh: "p256dh-key", auth: "auth-key" },
    } });
    const list = async (who: typeof user) => (await (await who.api.get("/api/notifications/subscriptions")).json()).data as { devices: number; items: { id: string; endpoint: string }[] };
    for (const n of [1, 2, 3]) expect((await subscribe(user, n)).status()).toBe(200);
    expect((await subscribe(other, 1)).status()).toBe(200);

    const before = await list(user);
    expect(before.devices).toBe(3);
    expect(before.items.map((item) => item.endpoint).sort()).toEqual([1, 2, 3].map((n) => `https://127.0.0.1:1/push/list-List Lou-${n}`));

    // Someone else's device id removes nothing
    const theirs = (await list(other)).items[0].id;
    expect((await user.api.delete(`/api/notifications/subscriptions/${theirs}`)).status()).toBe(200);
    expect((await list(other)).devices).toBe(1);

    expect((await user.api.delete(`/api/notifications/subscriptions/${before.items[0].id}`)).status()).toBe(200);
    const after = await list(user);
    expect(after.devices).toBe(2);
    expect(after.items.map((item) => item.id)).not.toContain(before.items[0].id);
});
