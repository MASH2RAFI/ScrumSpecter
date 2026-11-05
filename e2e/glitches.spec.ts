import { expect, test } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// The calendar's Unscheduled panel loads the first 100 undated tasks; it must say when there are more
test("unscheduled panel: says how many of the undated tasks it shows", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Una Unscheduled");
    const workspace = await createWorkspace(user.api, "Unscheduled WS");
    const project = await createProject(user.api, workspace.$id, "Backlog");
    const [me] = await getMembers(user.api, workspace.$id);
    for (let start = 0; start < 102; start += 17) {
        const batch = await Promise.all(Array.from({ length: Math.min(17, 102 - start) }, (_, i) =>
            createTask(user.api, { workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name: `Undated ${start + i}`, dueDate: undefined })));
        for (const res of batch) expect(res.status(), await res.text()).toBe(200);
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const panel = page.getByRole("complementary", { name: "Unscheduled tasks" });
    await expect(panel.getByText("Showing the first 100 of 102")).toBeVisible();
    // The badge counts every undated task, not only the ones loaded
    await expect(panel.locator("p", { hasText: /^Unscheduled/ }).locator("span")).toHaveText("102");
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// A project's eye saves the whole hidden list, so it must start from the account's latest copy:
// another device may have hidden a project since this page last looked
test("project eye: keeps a project another device hid in the meantime", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Eli Eyes");
    const workspace = await createWorkspace(user.api, "Eyes WS");
    const first = await createProject(user.api, workspace.$id, "Alpha");
    const second = await createProject(user.api, workspace.$id, "Beta");
    const [me] = await getMembers(user.api, workspace.$id);
    // The Routines page shows its filters (and the eyes) once there are routines
    for (const [name, projectId] of [["Alpha routine", first.$id], ["Beta routine", second.$id]]) {
        const res = await user.api.post("/api/routines", { data: { workspaceId: workspace.$id, name, projectId, assigneeIds: [me.$id], weekdays: [1, 2, 3, 4, 5, 6, 7] } });
        expect(res.status(), await res.text()).toBe(200);
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Hide Alpha from Routines" })).toBeVisible();

    // The "other device": hides Beta while this page still has the old list cached
    const other = await user.api.patch("/api/account/preferences", { data: { hiddenRoutineProjects: [second.$id] } });
    expect(other.status(), await other.text()).toBe(200);

    await page.getByRole("button", { name: "Hide Alpha from Routines" }).click();
    await expect(page.getByRole("button", { name: "Show Alpha in Routines" })).toBeVisible();
    await expect.poll(async () =>
        [...(await (await user.api.get("/api/account")).json()).data.preferences.hiddenRoutineProjects].sort(),
    ).toEqual([first.$id, second.$id].sort());
    // And the page itself shows Beta hidden too
    await expect(page.getByRole("button", { name: "Show Beta in Routines" })).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// A Kanban card shows a read-only preview of the task once the mouse rests on it
test("kanban card: hovering shows the full details, and leaving hides them", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Hal Hover");
    const workspace = await createWorkspace(user.api, "Hover WS");
    const project = await createProject(user.api, workspace.$id, "Hover project");
    const [me] = await getMembers(user.api, workspace.$id);
    const name = "Write the quarterly report for the whole regional team, with every chart";
    const made = await createTask(user.api, {
        workspaceId: workspace.$id, projectId: project.$id, assigneeId: me.$id, name, status: "IN_PROGRESS", storyPoints: 5,
        description: "Pull the numbers from the finance export first.",
    });
    expect(made.status(), await made.text()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=kanban`, { timeout: 90_000 });
    const card = page.locator("div.cursor-pointer", { hasText: name }).first();
    await expect(card).toBeVisible();

    const preview = page.getByTestId("task-hover-card");
    await expect(preview).toHaveCount(0);
    await card.hover();
    await expect(preview).toBeVisible();
    await expect(preview).toContainText(name);
    await expect(preview).toContainText("In Progress");
    await expect(preview).toContainText("5 points");
    await expect(preview).toContainText("Hover project");
    await expect(preview).toContainText("Pull the numbers from the finance export first.");

    await page.mouse.move(5, 5);
    await expect(preview).toHaveCount(0);
    // Pressing the card (a click or the start of a drag) closes it again
    await card.hover();
    await expect(preview).toBeVisible();
    await page.mouse.down();
    await expect(preview).toHaveCount(0);
    await page.mouse.up();
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// A version check can still be on its way when the person signs out. Its answer must not refetch the
// account (the session is gone: a 401). The check's answer is held back, and the sign-out page too,
// so the page is still alive when it arrives.
test("sign out: a version check still on its way does not refetch the account", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Sid Signout");
    const workspace = await createWorkspace(user.api, "Signout WS");
    const project = await createProject(user.api, workspace.$id, "Out");
    const [me] = await getMembers(user.api, workspace.$id);
    const made = await user.api.post("/api/routines", { data: { workspaceId: workspace.$id, name: "Daily", projectId: project.$id, assigneeIds: [me.$id], weekdays: [1, 2, 3, 4, 5, 6, 7] } });
    expect(made.status(), await made.text()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    const eye = page.getByRole("button", { name: "Hide Out from Routines" });
    await expect(eye).toBeVisible();

    await page.route("**/api/workspaces/versions", async (route) => {
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        // (the test may be over by now: a closed page can't be answered)
        await route.fulfill({ response }).catch(() => undefined);
    });
    await page.route("**/about", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 4_000));
        await route.continue().catch(() => undefined);
    });

    // A save schedules a check half a second later; sign out while its answer is still held back
    await eye.click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await page.waitForTimeout(3_000);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// Two quick eye clicks: the reply to the first save does not hold the second change yet, and must
// not flip the second eye back while its own save is still on its way
test("project eyes: a quick second click is not undone by the first save's reply", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Quick Quin");
    const workspace = await createWorkspace(user.api, "Quick WS");
    const [me] = await getMembers(user.api, workspace.$id);
    for (const name of ["Alpha", "Beta"]) {
        const project = await createProject(user.api, workspace.$id, name);
        const res = await user.api.post("/api/routines", { data: { workspaceId: workspace.$id, name: `${name} routine`, projectId: project.$id, assigneeIds: [me.$id], weekdays: [1, 2, 3, 4, 5, 6, 7] } });
        expect(res.status(), await res.text()).toBe(200);
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    await expect(page.getByRole("button", { name: "Hide Alpha from Routines" })).toBeVisible();

    let saves = 0;
    await page.route("**/api/account/preferences", async (route) => {
        if (route.request().method() !== "PATCH") return route.continue();
        const delay = ++saves === 1 ? 1_000 : 3_000;
        const response = await route.fetch();
        await new Promise((resolve) => setTimeout(resolve, delay));
        // (the test may be over by now: a closed page can't be answered)
        await route.fulfill({ response }).catch(() => undefined);
    });
    await page.getByRole("button", { name: "Hide Alpha from Routines" }).click();
    // (the first save reaches the server before the second, whose reply then holds both)
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Hide Beta from Routines" }).click();
    // The first reply has arrived (1 s), the second has not (3 s): Beta stays hidden
    // (sampled throughout: the wrong state is shown for under a second)
    for (let i = 0; i < 20; i++) {
        expect(await page.getByRole("button", { name: /Beta (from|in) Routines/ }).getAttribute("aria-label")).toBe("Show Beta in Routines");
        await page.waitForTimeout(100);
    }
    await expect(page.getByRole("button", { name: "Show Beta in Routines" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show Alpha in Routines" })).toBeVisible();
    await expect.poll(async () =>
        (await (await user.api.get("/api/account")).json()).data.preferences.hiddenRoutineProjects.length, { timeout: 8_000 }).toBe(2);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// Projects hidden in one workspace are not hidden "projects" in another: Home's note only counts its own
test("home: a project hidden in another workspace does not show a Following note here", async ({ browser, baseURL }) => {
    const user = await registerUser(baseURL!, "Nora Note");
    const first = await createWorkspace(user.api, "Note first");
    const hidden = await createProject(user.api, first.$id, "Hidden one");
    const second = await createWorkspace(user.api, "Note second");
    await createProject(user.api, second.$id, "Visible one");
    expect((await user.api.patch("/api/account/preferences", { data: { hiddenProjects: [hidden.$id] } })).status()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${second.$id}`, { timeout: 90_000 });
    await expect(page.getByRole("main").getByText("Visible one", { exact: true }).first()).toBeVisible();
    await expect(page.getByTestId("home-following")).toHaveCount(0);
    // Where the project is, the note counts it
    await page.goto(`/workspaces/${first.$id}`, { timeout: 90_000 });
    await expect(page.getByTestId("home-following")).toContainText("1 project hidden");
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// The notification settings list the account's devices; one that is gone can be removed from there
test("notification settings: a listed device can be removed", async ({ browser, baseURL }) => {
    test.skip(!!process.env.E2E_PROD, "the local fake push service is allowed only outside production (notifications/schemas.ts)");
    const user = await registerUser(baseURL!, "Dev Dee");
    const workspace = await createWorkspace(user.api, "Devices WS");
    for (const n of [1, 2]) {
        const res = await user.api.post("/api/notifications/subscriptions", { data: { endpoint: `https://127.0.0.1:1/push/ui-device-${n}`, keys: { p256dh: "p256dh-key", auth: "auth-key" } } });
        expect(res.status(), await res.text()).toBe(200);
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}?notification-settings=true`, { timeout: 90_000 });
    const dialog = page.getByRole("dialog", { name: "Notification settings" });
    const list = dialog.getByRole("list", { name: "Devices with notifications on" });
    await expect(list.getByRole("listitem")).toHaveCount(2);
    await list.getByRole("button", { name: /^Remove/ }).first().click();
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(dialog.getByText("Set up on 1 device.")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});
