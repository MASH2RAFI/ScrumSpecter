import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// The first screen after signing in, or after opening the app with an old session, asks the server
// in as few round trips as it can: the requests travel together (POST /api/batch), and after signing
// in they are on their way before the page has even opened.
const watchApi = (page: Page) => {
    const calls: string[] = [];
    page.on("request", (r) => {
        const url = new URL(r.url());
        if (url.pathname.startsWith("/api/")) calls.push(`${r.method()} ${url.pathname}`);
    });
    return calls;
};
const PAGE_DATA = /^GET \/api\/(projects|members|routines|change-requests|notifications|tasks(\/summary)?|workspaces\/[\w-]{20,})$/;

test("signing in lands on the home page directly, with its data fetched in one batch", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "First Fay");
    const workspace = await createWorkspace(user.api, "First WS");
    await createProject(user.api, workspace.$id, "Visible project");

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await page.goto("/sign-in", { timeout: 90_000 });
    await page.getByPlaceholder("Enter email address").fill(user.email);
    await page.getByPlaceholder("Enter password").fill(user.password);
    const calls = watchApi(page);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Straight to the workspace (no stop on "/"), showing the data that was fetched
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace.$id}$`), { timeout: 30_000 });
    await expect(page.getByRole("main").getByText("Visible project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    expect(calls.filter((call) => call === "POST /api/batch")).toHaveLength(1);
    expect(calls.filter((call) => PAGE_DATA.test(call)), calls.join("\n")).toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

test("opening the app with a session but no saved data asks for it in a batch", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Cold Cal");
    const workspace = await createWorkspace(user.api, "Cold WS");
    await createProject(user.api, workspace.$id, "Cold project");

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    const calls = watchApi(page);
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Cold project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    expect(calls.filter((call) => call === "POST /api/batch").length).toBeGreaterThanOrEqual(1);
    expect(calls.filter((call) => PAGE_DATA.test(call)), calls.join("\n")).toEqual([]);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// The browser keeps what it fetched for a week. A copy more than an hour old is shown at once and
// refreshed behind the screen (Home's overdue count depends on the time, not only on edits); one
// more than a week old is not used.
test.describe("saved copy", () => {
    const KEY = "scrumspecter-cache";
    const DELAY = 3_000;

    const openWithCopyAged = async (browser: import("@playwright/test").Browser, baseURL: string, ageMs: number, projectName: string, staleName?: string) => {
        const user = await registerUser(baseURL, "Copy Cory");
        const workspace = await createWorkspace(user.api, "Copy WS");
        await createProject(user.api, workspace.$id, projectName);
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = watchConsole(page);
        await signInBrowser(page, user, baseURL);
        await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
        const project = page.getByRole("main").getByText(projectName).first();
        await expect(project).toBeVisible({ timeout: 30_000 });
        // The copy is written a moment after a change; then it is made to look older
        await expect.poll(() => page.evaluate((key) => Boolean(window.localStorage.getItem(key)), KEY)).toBe(true);
        await page.waitForTimeout(1_500);
        await page.evaluate(([key, age, stale]) => {
            const copy = JSON.parse(window.localStorage.getItem(key)!);
            copy.timestamp = Date.now() - Number(age);
            // What the copy says is out of date, though no edit has moved any version
            if (stale) {
                const projects = copy.clientState.queries.find((query: { queryKey: unknown[] }) => query.queryKey[0] === "projects");
                projects.state.data.documents[0].name = stale;
            }
            window.localStorage.setItem(key, JSON.stringify(copy));
        }, [KEY, ageMs, staleName ?? ""] as const);

        // The server now answers slowly, so what shows before it does comes from the saved copy
        const requests: string[] = [];
        page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/batch") requests.push(r.url()); });
        await page.route("**/api/**", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, DELAY));
            await route.continue().catch(() => undefined);
        });
        await page.reload({ timeout: 90_000, waitUntil: "commit" });
        return { page, project, errors, requests };
    };

    test("a copy a few days old shows at once and is refreshed behind it", async ({ browser, baseURL }) => {
        const { page, errors } = await openWithCopyAged(browser, baseURL!, 3 * 24 * 3_600_000, "Days old project", "Stale name");
        const main = page.getByRole("main");
        // At once, before the slow server answers: the copy, as it was saved
        await expect(main.getByText("Stale name").first()).toBeVisible({ timeout: DELAY - 500 });
        // Then the answer replaces it
        await expect(main.getByText("Days old project").first()).toBeVisible({ timeout: 20_000 });
        await expect(main.getByText("Stale name")).toHaveCount(0);
        expect(errors, errors.join("\n")).toEqual([]);
        await page.close();
    });

    test("a copy more than a week old is not used", async ({ browser, baseURL }) => {
        const { page, project, errors } = await openWithCopyAged(browser, baseURL!, 8 * 24 * 3_600_000, "Weeks old project");
        // Nothing to show until the (slow) server answers
        await page.waitForTimeout(DELAY - 1_000);
        await expect(project).toHaveCount(0);
        await expect(project).toBeVisible({ timeout: 20_000 });
        expect(errors, errors.join("\n")).toEqual([]);
        await page.close();
    });
});

// The HTML starts Home's requests from the server (which runs in UTC): the week must be the one the
// browser will ask for, in the person's own time zone, or every early answer is wasted
test("opening Home from a link in another time zone: the early requests are the ones the page needs", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Zone Zed");
    const workspace = await createWorkspace(user.api, "Zone WS");
    await createProject(user.api, workspace.$id, "Zone project");
    const saved = await user.api.patch("/api/account/preferences", { data: { timeZone: "Pacific/Auckland" } });
    expect(saved.status(), await saved.text()).toBe(200);

    const context = await browser.newContext({ timezoneId: "Pacific/Auckland", viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    const calls = watchApi(page);
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Zone project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    // No task request of its own after the batches: the early ones were the right ones
    expect(calls.filter((call) => PAGE_DATA.test(call)), calls.join("\n")).toEqual([]);
    expect(calls.filter((call) => call === "POST /api/batch").length, calls.join("\n")).toBe(1);
    expect(errors, errors.join("\n")).toEqual([]);
    await context.close();
});

// A failed batch (the early one from the HTML, then the page's own) must not leave the page empty: the requests are made on their own
// (this does not tell the early fallback from the page's own retry; it guards that the page opens)
test("opening Home from a link when every batch fails: the page still opens with its data", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Fail Fay");
    const workspace = await createWorkspace(user.api, "Fail WS");
    await createProject(user.api, workspace.$id, "Fail project");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await signInBrowser(page, user, baseURL!);
    await page.route("**/api/batch", (route) => route.fulfill({ status: 500, body: "" }));
    const calls = watchApi(page);
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Fail project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    // Made on their own after the batches failed
    expect(calls, calls.join("\n")).toContain("GET /api/projects");
    expect(calls, calls.join("\n")).toContain("GET /api/members");
    await page.close();
});

// The sidebar is a narrow strip until the pointer is on it. WebKit checks where a link will be hit
// before the pointer moves, so put the pointer on the strip first, as a person's hand would
const onSidebar = (page: import("@playwright/test").Page) => page.getByRole("complementary").first().hover({ position: { x: 20, y: 200 } });

// Once the app is running, a skeleton shows only if a load takes more than a moment
test("in-app skeletons fade in late, so quick loads never flash one", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Skeleton Sky");
    const workspace = await createWorkspace(user.api, "Skeleton WS");
    await createProject(user.api, workspace.$id, "Skeleton project");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Skeleton project").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => "started" in document.documentElement.dataset)).toBe(true);

    // The task list isn't loaded yet, and the server answers slowly
    await page.route("**/api/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue().catch(() => undefined);
    });
    const opacityNow = () => page.evaluate(() => {
        const skeleton = document.querySelector("main .skeleton-late");
        return skeleton ? Number(getComputedStyle(skeleton).opacity) : null;
    });
    // Read inside the page at the moment the skeleton first appears (a later look could come after
    // its delay on a busy machine)
    const firstSeen = page.evaluate(() => new Promise<number>((resolve) => {
        const look = () => {
            const skeleton = document.querySelector("main .skeleton-late");
            if (!skeleton) return;
            observer.disconnect();
            resolve(Number(getComputedStyle(skeleton).opacity));
        };
        const observer = new MutationObserver(look);
        observer.observe(document.body, { childList: true, subtree: true });
        look();
    }));
    await onSidebar(page);
    await page.getByRole("link", { name: "My Tasks" }).first().click();
    // When it first appears it is invisible, and a moment later it is there
    expect(await firstSeen).toBeLessThan(0.3);
    await expect.poll(opacityNow, { timeout: 1_200, intervals: [50] }).toBeGreaterThan(0.45);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// Moving the pointer onto a sidebar link starts that page's requests, so the click finds them answered
test.describe("hovering a link", () => {
    const setup = async (browser: import("@playwright/test").Browser, baseURL: string, start: string) => {
        const user = await registerUser(baseURL, "Hover Hana");
        const workspace = await createWorkspace(user.api, "Hover WS");
        const project = await createProject(user.api, workspace.$id, "Hover project");
        const [me] = await getMembers(user.api, workspace.$id);
        const created = await createTask(user.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name: "Hover task", dueDate: new Date().toISOString() });
        expect(created.status(), await created.text()).toBe(200);
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = watchConsole(page);
        await signInBrowser(page, user, baseURL);
        await page.goto(`/workspaces/${workspace.$id}${start}`, { timeout: 90_000 });
        return { page, errors, workspace };
    };
    const TASK_REQUESTS = /^(GET \/api\/(tasks|stars\/ids)|POST \/api\/batch)/;

    test("My Tasks: the table's requests start on hover, and the click asks for nothing", async ({ browser, baseURL }) => {
        const { page, errors } = await setup(browser, baseURL!, "");
        await expect(page.getByRole("main").getByText("Hover project").first()).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState("networkidle");
        const calls = watchApi(page);

        await onSidebar(page);
        await page.getByRole("link", { name: "My Tasks" }).first().hover();
        await expect.poll(() => calls.filter((call) => call === "POST /api/batch").length, { timeout: 5_000 }).toBe(1);
        await page.waitForTimeout(500);
        const afterHover = calls.length;

        await page.getByRole("link", { name: "My Tasks" }).first().click();
        await expect(page.getByRole("button", { name: "Hover task", exact: true })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState("networkidle");
        expect(calls.slice(afterHover).filter((call) => TASK_REQUESTS.test(call)), calls.join("\n")).toEqual([]);
        expect(errors, errors.join("\n")).toEqual([]);
        await page.close();
    });

    test("Home: its requests start on hover, and the click asks for nothing", async ({ browser, baseURL }) => {
        const { page, errors } = await setup(browser, baseURL!, "/tasks");
        await expect(page.getByRole("button", { name: "Hover task", exact: true })).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState("networkidle");
        const calls = watchApi(page);

        await onSidebar(page);
        await page.getByRole("link", { name: "Home", exact: true }).first().hover();
        await expect.poll(() => calls.filter((call) => call === "POST /api/batch").length, { timeout: 5_000 }).toBe(1);
        await page.waitForTimeout(500);
        const afterHover = calls.length;

        await page.getByRole("link", { name: "Home", exact: true }).first().click();
        await expect(page.getByRole("main").getByText("Hover project").first()).toBeVisible({ timeout: 30_000 });
        await page.waitForLoadState("networkidle");
        expect(calls.slice(afterHover).filter((call) => TASK_REQUESTS.test(call)), calls.join("\n")).toEqual([]);
        expect(errors, errors.join("\n")).toEqual([]);
        await page.close();
    });
});

// Home's counts depend on the clock (a task becomes overdue as time passes, and no edit says so), so
// they are asked again when the tab is used after a few minutes, but not before
test("Home asks for its counts again after a few minutes, not sooner", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Clock Cleo");
    const workspace = await createWorkspace(user.api, "Clock WS");
    await createProject(user.api, workspace.$id, "Clock project");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.clock.install({ time: new Date() });

    let summaries = 0;
    page.on("request", (r) => {
        const urls = new URL(r.url()).pathname === "/api/batch"
            ? ((JSON.parse(r.postData() ?? "{}") as { requests?: string[] }).requests ?? [])
            : [r.url()];
        summaries += urls.filter((url) => url.includes("/api/tasks/summary")).length;
    });
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Clock project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    const first = summaries;
    expect(first).toBeGreaterThanOrEqual(1);
    // Switching away from the tab and back, which is what "used again" means to the browser
    const awayAndBack = () => page.evaluate(() => {
        const show = (state: string) => {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
            document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
        };
        show("hidden");
        show("visible");
    });

    // A minute later: nothing to ask
    await page.clock.fastForward("01:00");
    await awayAndBack();
    await page.waitForTimeout(1_200);
    expect(summaries).toBe(first);

    // Six minutes later: asked again
    await page.clock.fastForward("05:30");
    await awayAndBack();
    await expect.poll(() => summaries, { timeout: 10_000 }).toBeGreaterThan(first);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// Once sign-out has started the page is about to be replaced; nothing may ask the server for more
// (it would meet a 401 and show up as an error)
test("once signing out has started, the app asks for nothing more", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Leave Lou");
    const workspace = await createWorkspace(user.api, "Leave WS");
    await createProject(user.api, workspace.$id, "Leave project");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.clock.install({ time: new Date() });
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Leave project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    // Home's counts are due for a refresh, so coming back to the tab would normally ask again
    await page.clock.fastForward("06:00");

    // A slow sign-out leaves the page open for a moment after the click
    await page.route("**/api/auth/logout", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_500));
        await route.continue().catch(() => undefined);
    });
    const reads: string[] = [];
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    page.on("request", (r) => { if (r.method() === "GET" && new URL(r.url()).pathname.startsWith("/api/")) reads.push(r.url()); });
    page.on("request", (r) => { if (new URL(r.url()).pathname === "/api/batch") reads.push(r.url()); });
    await page.evaluate(() => {
        const show = (state: string) => {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
            document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
        };
        show("hidden");
        show("visible");
    });
    await page.waitForTimeout(800);
    expect(reads, reads.join("\n")).toEqual([]);
    await expect(page).toHaveURL(/\/about$/, { timeout: 15_000 });
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// A sign-out that fails (offline, a server error) must not leave anything loading for ever: the
// reads that were held while it was under way are sent once it has failed
test("a failed sign-out lets the held reads go", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Stay Sam");
    const workspace = await createWorkspace(user.api, "Stay WS");
    await createProject(user.api, workspace.$id, "Stay project");
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.clock.install({ time: new Date() });
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Stay project").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    await page.clock.fastForward("06:00");

    await page.route("**/api/auth/logout", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "nope" }) });
    });
    const reads: string[] = [];
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    // (counted from the click: opening the menu may ask for things of its own)
    page.on("request", (r) => {
        const path = new URL(r.url()).pathname;
        if ((r.method() === "GET" && path.startsWith("/api/")) || path === "/api/batch") reads.push(path);
    });
    // While the sign-out is under way, the tab is used again: Home's counts are due, but held
    await page.evaluate(() => {
        const show = (state: string) => {
            Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
            document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
        };
        show("hidden");
        show("visible");
    });
    await page.waitForTimeout(400);
    expect(reads).toEqual([]);

    // It fails: the held read goes out, and the app is still here
    await expect(page.getByText("Logout failed")).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => reads.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace.$id}$`));
    await page.close();
});
