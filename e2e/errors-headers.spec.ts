import { expect, request, test } from "@playwright/test";

import { registerUser, signInBrowser } from "./helpers";

// Error handling (TODO §5) and security headers (TODO §25)

test("an unknown API route returns a JSON 404", async ({ baseURL }) => {
    const anon = await request.newContext({ baseURL });
    const res = await anon.get("/api/nope");
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect((await res.json()).error).toBeTruthy();
    await anon.dispose();
});

test("an unknown page shows the not-found page", async ({ page, baseURL }) => {
    // Signed out, the middleware sends unknown pages to sign-in, so sign in first
    const user = await registerUser(baseURL!);
    await signInBrowser(page, user, baseURL!);
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
});

test("security headers are set", async ({ baseURL }) => {
    const anon = await request.newContext({ baseURL });
    const page = await anon.get("/");
    const headers = page.headers();
    // Enforced, with a fresh nonce per page that Next puts on its scripts
    const csp = headers["content-security-policy"];
    expect(headers["content-security-policy-report-only"]).toBeUndefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce).toBeTruthy();
    expect(await page.text()).toContain(`nonce="${nonce}"`);
    expect((await anon.get("/")).headers()["content-security-policy"]).not.toBe(csp);
    expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-xss-protection"]).toBeUndefined();

    expect((await anon.get("/sw.js")).headers()["cache-control"]).toBe("no-cache");
    await anon.dispose();
});
