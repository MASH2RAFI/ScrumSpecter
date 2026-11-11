import { expect, test } from "@playwright/test";

import { Hono } from "hono";

import { continuePage, continueTo, safeNextPath } from "../src/lib/safe-next";

// Where sign-in goes afterwards is taken from the address (?next=) and, for Google, from a cookie, then written into a page.
// Only plain same-site paths may pass; anything that could leave the site or break out of that page must not.
test("safeNextPath lets ordinary same-site paths through", () => {
    for (const path of ["/", "/workspaces/abc-123", "/workspaces/abc-123/join/Xy9_z-Q", "/workspaces/abc/tasks?task-view=calendar&cal=week&status=IN_PROGRESS", "/account?tab=security#devices", "/workspaces/a%20b/tasks?search=%22x%22",
        // What encodeURIComponent leaves unencoded in a search text, as the app writes it into addresses
        "/workspaces/abc/tasks?search=fix%20bug%20(login)", "/workspaces/abc/tasks?search=it's%20done", "/workspaces/abc/tasks?search=urgent!&x=a*b"]) {
        expect(safeNextPath(path), path).toBe(path);
    }
});

test("safeNextPath refuses other sites, the API, and anything that could break out of the page", () => {
    const refused = [
        "//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "", null, undefined,
        // Browsers drop a tab, newline or carriage return, so these would go to //evil.com
        "/\t/evil.com", "/\n/evil.com", "/\r/evil.com",
        // Markup and quotes (written into an HTML attribute and a script)
        '/"><script>alert(1)</script>', "/'><img src=x onerror=alert(1)>", "/</script><script>alert(1)</script>", "/`x`", "/a b", "/a\u0000b", "/é",
        "/api/auth/logout", "/" + "a".repeat(600),
    ];
    for (const path of refused) expect(safeNextPath(path as string | null | undefined), JSON.stringify(path)).toBeNull();
});

test("continueTo cannot be made to add markup, whatever path it is given, and has no script to run", () => {
    const html = continueTo('/"><script>alert(1)</script>');
    // No script at all: the quote and brackets are escaped in the attribute
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)</script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
    expect(html.match(/<meta http-equiv="refresh"/g)).toHaveLength(1);
    // And a normal path is written as it is
    expect(continueTo("/workspaces/abc?x=1&y=2")).toContain('url=/workspaces/abc?x=1&amp;y=2"');
});

test("continuePage sends the refresh page with a policy that forbids every script", async () => {
    const app = new Hono().get("/", (c) => continuePage(c, "/sign-in?error=google_failed"));
    const response = await app.request("/");
    expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('content="0;url=/sign-in?error=google_failed"');
});
