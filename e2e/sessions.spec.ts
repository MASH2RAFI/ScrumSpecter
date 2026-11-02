import { createHash } from "node:crypto";

import { expect, request, test } from "@playwright/test";

import { registerUser, sql } from "./helpers";

// Sessions end after 30 days unused; each use (checked every few minutes) moves the end forward
test("using a session renews its expiry and the cookie", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Sasha Session");
    // A fresh sign-in: a session this server hasn't cached yet
    const anon = await request.newContext({ baseURL });
    const login = await anon.post("/api/auth/login", { data: { email: user.email, password: user.password } });
    expect(login.status()).toBe(200);
    const cookie = login.headers()["set-cookie"].split(";")[0];
    const id = createHash("sha256").update(cookie.split("=")[1]).digest("hex");
    await anon.dispose();

    // Last used 6 minutes ago, ending tomorrow
    await sql("update sessions set last_seen_at = now() - interval '6 minutes', expires_at = now() + interval '1 day' where id = $1", [id]);

    const api = await request.newContext({ baseURL, extraHTTPHeaders: { cookie } });
    const res = await api.get("/api/workspaces");
    expect(res.status()).toBe(200);
    expect(res.headers()["set-cookie"] ?? "").toMatch(/specter-session=.*Max-Age=2592000/i);
    await expect.poll(async () => {
        const [row] = await sql<{ days: number }>("select extract(epoch from expires_at - now()) / 86400 as days from sessions where id = $1", [id]);
        return Number(row.days);
    }).toBeGreaterThan(29);
    await api.dispose();
});
