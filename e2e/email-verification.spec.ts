import { createHash, randomBytes } from "node:crypto";

import { expect, request, test } from "@playwright/test";

import { registerUser, signInBrowser, sql } from "./helpers";

// Sign-up sends a verification link; the app works either way (a soft gate)
test.describe.configure({ mode: "serial" });

// The test database (e2e/db-server.mjs): the emailed token isn't readable, so a known one is
// planted the way the server stores it (as in qol-api.spec.ts's password reset)
const plantToken = async (userId: string, expires = "now() + interval '1 hour'") => {
    const token = randomBytes(32).toString("base64url");
    await sql(`insert into email_verifications (id, user_id, expires_at) values ($1, $2, ${expires})`,
        [createHash("sha256").update(token).digest("hex"), userId]);
    return token;
};

test("a new account starts unverified; the emailed link verifies it once", async ({ baseURL }) => {
    // No mail provider in tests: sign-up still succeeds
    const user = await registerUser(baseURL!, "Vera Verify");
    const [{ id: userId, email_verified_at }] = await sql<{ id: string; email_verified_at: Date | null }>(
        "select id, email_verified_at from users where email = $1", [user.email]);
    expect(email_verified_at).toBeNull();
    expect(await sql("select 1 from email_verifications where user_id = $1", [userId])).toHaveLength(1);
    expect((await (await user.api.get("/api/auth/email-verification")).json()).data).toEqual({ verified: false });
    // The app still works
    expect((await user.api.post("/api/workspaces", { multipart: { name: "Unverified but working" } })).status()).toBe(200);

    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/auth/verify-email", { data: { token: "not-a-real-token-at-all-123" } })).status()).toBe(400);
    const expired = await plantToken(userId, "now() - interval '1 minute'");
    expect((await anon.post("/api/auth/verify-email", { data: { token: expired } })).status()).toBe(400);

    const token = await plantToken(userId);
    expect((await anon.post("/api/auth/verify-email", { data: { token } })).status()).toBe(200);
    expect((await anon.post("/api/auth/verify-email", { data: { token } })).status()).toBe(400);
    expect((await (await user.api.get("/api/auth/email-verification")).json()).data).toEqual({ verified: true });
    await anon.dispose();
});

test("resending is rate-limited", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Rhea Resend");
    for (let i = 0; i < 3; i++) {
        expect((await user.api.post("/api/auth/email-verification/resend")).status()).toBe(200);
    }
    expect((await user.api.post("/api/auth/email-verification/resend")).status()).toBe(429);
});

test("changing the email needs verifying again", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Cleo Change");
    await sql("update users set email_verified_at = now() where email = $1", [user.email]);
    expect((await (await user.api.get("/api/auth/email-verification")).json()).data).toEqual({ verified: true });
    await sql("update users set email = $1 where email = $2", [`changed-${user.email}`, user.email]);
    const [row] = await sql<{ email_verified_at: Date | null }>("select email_verified_at from users where email = $1", [`changed-${user.email}`]);
    expect(row.email_verified_at).toBeNull();
});

test("a link mailed to the old address can't verify a changed email", async ({ baseURL }) => {
    const user = await registerUser(baseURL!, "Ivy Imposter");
    const [{ id }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);
    const oldLink = await plantToken(id);
    // Switch the account to an address the person doesn't control, then use the old link
    await sql("update users set email = $1 where id = $2", [`not-mine-${user.email}`, id]);
    const anon = await request.newContext({ baseURL });
    expect((await anon.post("/api/auth/verify-email", { data: { token: oldLink } })).status()).toBe(400);
    await anon.dispose();
    const [row] = await sql<{ email_verified_at: Date | null }>("select email_verified_at from users where id = $1", [id]);
    expect(row.email_verified_at).toBeNull();
});

test("the verify page confirms with a button", async ({ page, baseURL }) => {
    const user = await registerUser(baseURL!, "Penny Page");
    const [{ id }] = await sql<{ id: string }>("select id from users where email = $1", [user.email]);
    const token = await plantToken(id);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/verify-email?token=${token}`, { timeout: 90_000 });
    await page.getByRole("button", { name: "Verify my email" }).click();
    await expect(page.getByText("Email verified")).toBeVisible();
    const [row] = await sql<{ email_verified_at: Date | null }>("select email_verified_at from users where id = $1", [id]);
    expect(row.email_verified_at).not.toBeNull();
});
