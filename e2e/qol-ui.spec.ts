import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: return paths through sign-in, password reset pages, invite limits, undo, bulk edit,
// quick dates, shortcuts help and the Tomorrow group
test.describe.configure({ mode: "serial" });

let page: Page;
let errors: string[];
let admin: TestUser;
let workspace: { $id: string; inviteCode: string };
let projectId: string;
let memberId: string;

const localNoon = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
};

test.beforeAll(async ({ browser, baseURL }) => {
    admin = await registerUser(baseURL!, "Quality Quinn");
    workspace = await createWorkspace(admin.api, "Quality WS");
    projectId = (await createProject(admin.api, workspace.$id, "Website", 14)).$id;
    memberId = (await getMembers(admin.api, workspace.$id))[0].$id;
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    errors = watchConsole(page);
});

test.afterAll(async () => {
    await page.close();
});

test.afterEach(() => {
    // Wrong-password 401s and 400s from the API are expected in some steps
    const unexpected = errors.filter((error) => !/http (401|400|429):|status of (401|400|429)/.test(error));
    expect(unexpected, unexpected.join("\n")).toEqual([]);
    errors.length = 0;
});

test("an invite link opened signed out comes back after signing in", async ({ baseURL }) => {
    const guest = await registerUser(baseURL!, "Guest Gia");
    const invite = `/workspaces/${workspace.$id}/join/${workspace.inviteCode}`;

    await page.goto(invite, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await expect(page.getByText("Sign in to accept the workspace invite.")).toBeVisible();

    // A wrong password says so
    await page.getByPlaceholder("Enter email address").fill(guest.email);
    await page.getByPlaceholder("Enter password").fill("wrong-password!");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByText("Wrong email or password")).toBeVisible();

    await page.getByPlaceholder("Enter password").fill(guest.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(new RegExp(`${invite}$`), { timeout: 60_000 });
    await page.getByRole("button", { name: "Join Workspace" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace.$id}$`), { timeout: 60_000 });

    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/about$/);
});

test("a shared task link opened signed out comes back after signing in", async () => {
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=kanban`, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/sign-in\?next=/);
    await page.getByPlaceholder("Enter email address").fill(admin.email);
    await page.getByPlaceholder("Enter password").fill(admin.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(new RegExp(`/workspaces/${workspace.$id}/tasks\\?task-view=kanban$`), { timeout: 60_000 });
});

test("forgot and reset password pages", async () => {
    await page.context().clearCookies();
    await page.goto("/sign-in", { timeout: 90_000 });
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Email me a link" }).click();
    await expect(page.getByRole("status")).toContainText("If an account exists for that email");

    await page.goto("/reset-password?token=not-a-real-token-at-all-123", { timeout: 90_000 });
    await page.getByLabel("New password", { exact: true }).fill("a-new-password-1");
    await page.getByLabel("Confirm new password").fill("a-new-password-1");
    await page.getByRole("button", { name: "Save new password" }).click();
    // (Next.js has its own role="alert" route announcer)
    await expect(page.getByRole("alert").filter({ hasText: "invalid or has expired" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ask for a new link" })).toBeVisible();
});

test("invite limits in workspace settings", async ({ baseURL }) => {
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Invites" }).click();
    // One person already joined in the first test
    await expect(settings.getByText("Never expires · 1 joined")).toBeVisible();
    await settings.getByRole("combobox", { name: "Can be used by" }).click();
    await page.getByRole("listbox").getByRole("option", { name: "5 people", exact: true }).click();
    await expect(settings.getByText("Never expires · 0 of 5 places used")).toBeVisible();
    await settings.getByRole("combobox", { name: "Expires" }).click();
    await page.getByRole("listbox").getByRole("option", { name: "In 7 days" }).click();
    await expect(settings.getByText(/^Expires .* · 0 of 5 places used$/)).toBeVisible();
    await page.keyboard.press("Escape");
});

test("invite by email opens a ready-written Gmail message", async () => {
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Invites" }).click();
    await page.evaluate(() => {
        (window as unknown as { opened: string[] }).opened = [];
        window.open = ((url: string) => {
            (window as unknown as { opened: string[] }).opened.push(String(url));
            return null;
        }) as typeof window.open;
    });

    await settings.getByLabel("Invite by email").fill("not-an-email");
    await settings.getByRole("button", { name: "Send with Gmail" }).click();
    await expect(settings.getByText("Enter one or more email addresses")).toBeVisible();

    await settings.getByLabel("Invite by email").fill("ana@example.com, ben@example.com");
    await settings.getByRole("button", { name: "Send with Gmail" }).click();
    const [opened] = await page.evaluate(() => (window as unknown as { opened: string[] }).opened);
    const url = new URL(opened);
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("ana@example.com,ben@example.com");
    expect(url.searchParams.get("su")).toBe("Join Quality WS on ScrumSpecter");
    expect(url.searchParams.get("body")).toContain(`/workspaces/${workspace.$id}/join/`);
    expect(url.searchParams.get("body")).toContain("Quality Quinn invited you");
    await page.keyboard.press("Escape");
});

test("placeholders in the Members popup", async () => {
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=members`, { timeout: 90_000 });
    const panel = page.getByRole("dialog", { name: "Members" });
    const form = panel.getByRole("form", { name: "Add a placeholder" });
    await form.getByLabel("Placeholder name").fill("QA (TBD)");
    await form.getByRole("button", { name: "Add" }).click();
    await expect(panel.getByText("QA (TBD)")).toBeVisible();
    await expect(panel.getByText("Placeholder", { exact: true })).toBeVisible();

    // Hand it to someone who has joined (Guest Gia, from the first test)
    await panel.getByRole("button", { name: "Options for QA (TBD)" }).click();
    await page.getByRole("menuitem", { name: "Guest Gia" }).click();
    await expect(page.getByText("Tasks handed over")).toBeVisible();
    await expect(panel.getByText("QA (TBD)")).toHaveCount(0);
    await page.keyboard.press("Escape");
});

test("working hours: set in General, frame the week overview; all-day routines fill the day", async () => {
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await expect(settings.getByRole("tab", { name: "General" })).toHaveAttribute("data-state", "active");

    // The end can't be before the start
    await settings.getByLabel("Day starts").fill("10:00");
    await settings.getByLabel("Day ends").fill("09:00");
    await expect(settings.getByText("The day has to end after it starts.")).toBeVisible();
    await expect(settings.getByRole("button", { name: "Save changes" })).toBeDisabled();

    await settings.getByLabel("Day starts").fill("10:00");
    await settings.getByLabel("Day ends").fill("16:00");
    await settings.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Workspace updated|updated/i).first()).toBeVisible();
    await page.keyboard.press("Escape");

    await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Inbox zero", projectId, assigneeIds: [memberId], weekdays: [1, 2, 3, 4, 5, 6, 7] },
    });
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    const week = page.getByLabel("Routines by weekday");
    // No "All day" row any more; the grid starts at the working day's start
    await expect(week.getByText("All day", { exact: true }).first()).toBeVisible();
    await expect(week.getByText("10 AM", { exact: true })).toBeVisible();
    await expect(week.getByText("9 AM", { exact: true })).toHaveCount(0);
    // The all-day routine spans 10 AM to 4 PM (6 hours of 48px)
    const block = (await week.getByRole("region", { name: "Monday" }).getByRole("button", { name: /Inbox zero/ }).boundingBox())!;
    const ten = (await week.getByText("10 AM", { exact: true }).boundingBox())!;
    expect(Math.abs(block.y - ten.y)).toBeLessThan(12);
    expect(block.height).toBeGreaterThan(6 * 48 - 8);
    expect(block.height).toBeLessThan(6 * 48 + 2);
});

test("a browser cache saved before a new field doesn't break the page", async () => {
    // A copy from before working hours existed (old cache version, workspace without the fields)
    await page.evaluate((id) => {
        localStorage.setItem("scrumspecter-cache", JSON.stringify({
            buster: "2026-10-26.2",
            timestamp: Date.now(),
            clientState: {
                mutations: [],
                queries: [{
                    queryKey: ["workspace", id],
                    queryHash: JSON.stringify(["workspace", id]),
                    state: { data: { $id: id, name: "Old copy" }, status: "success", dataUpdatedAt: Date.now(), fetchStatus: "idle" },
                }],
            },
        }));
    }, workspace.$id);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    await expect(page.getByLabel("Routines by weekday").getByText("10 AM", { exact: true })).toBeVisible();
});

test("bulk input tab: check, apply, and copy the AI prompt", async () => {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/workspaces/${workspace.$id}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Bulk input" }).click();

    await settings.getByLabel("Commands").fill(`task add "From bulk" project:"Website" due:tomorrow\ntask add "Broken" project:"Nowhere"`);
    await settings.getByRole("button", { name: "Check" }).click();
    const results = settings.getByRole("list", { name: "Check results" });
    await expect(results.getByText('No project called "Nowhere"')).toBeVisible();
    await expect(settings.getByRole("button", { name: /^Apply/ })).toBeDisabled();

    await settings.getByLabel("Commands").fill(`task add "From bulk" project:"Website" due:tomorrow`);
    await expect(settings.getByText("Changed since the check")).toBeVisible();
    await settings.getByRole("button", { name: "Check" }).click();
    await settings.getByRole("button", { name: "Apply 1 change" }).click();
    await expect(page.getByText("Added 1 task")).toBeVisible();

    await settings.getByRole("button", { name: "Copy AI prompt" }).click();
    const prompt = await page.evaluate(() => navigator.clipboard.readText());
    expect(prompt).toContain("Reply with ONLY the commands");
    expect(prompt).toContain('Existing projects: "Website"');
    expect(prompt).toContain("task add \"<name>\" project:");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "From bulk", exact: true }).or(page.getByText("From bulk")).first()).toBeAttached();
});

test("undo after deleting a task", async () => {
    await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: memberId, name: "Delete me" });
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=table`, { timeout: 90_000 });
    await page.getByRole("button", { name: "Actions for Delete me" }).click();
    await page.getByRole("menuitem", { name: "Delete Task" }).click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("button", { name: "Delete me", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Task restored")).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete me", exact: true })).toBeVisible();
});

test("bulk edit: tick tasks, change status, undo", async () => {
    for (const name of ["Bulk A", "Bulk B", "Bulk C"]) {
        await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: memberId, name });
    }
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=table`, { timeout: 90_000 });
    for (const name of ["Bulk A", "Bulk B", "Bulk C"]) {
        await page.getByRole("row", { name: new RegExp(name) }).getByRole("checkbox", { name: "Select task" }).click();
    }
    const bar = page.getByRole("toolbar", { name: "Bulk actions" });
    await expect(bar.getByText("3 selected")).toBeVisible();
    await bar.getByRole("combobox", { name: "Set status" }).click();
    await page.getByRole("listbox").getByRole("option", { name: "Done", exact: true }).click();
    await expect(page.getByText("Updated 3 tasks")).toBeVisible();
    await expect(bar).toBeHidden();
    for (const name of ["Bulk A", "Bulk B", "Bulk C"]) {
        await expect(page.getByRole("button", { name: `Change status of ${name} (Done)` })).toBeVisible();
    }
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("Changes undone")).toBeVisible();
    for (const name of ["Bulk A", "Bulk B", "Bulk C"]) {
        await expect(page.getByRole("button", { name: `Change status of ${name} (Todo)` })).toBeVisible();
    }
});

test("table: Shift-click selects a range, Ctrl-click toggles, a plain row click opens the task", async () => {
    for (const n of [1, 2, 3, 4, 5]) {
        await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: memberId, name: `Range ${n}` });
    }
    await page.goto(`/workspaces/${workspace.$id}/tasks?task-view=table`, { timeout: 90_000 });
    await page.getByPlaceholder("Search tasks...").fill("Range");
    const rows = page.getByRole("row").filter({ hasText: /Range \d/ });
    await expect(rows).toHaveCount(5);
    // A plain cell in each row (the due date), away from its buttons
    const cell = (i: number) => rows.nth(i).getByRole("cell").nth(4);
    const bar = page.getByRole("toolbar", { name: "Bulk actions" });

    await rows.nth(0).getByRole("checkbox", { name: "Select task" }).click();
    await rows.nth(3).getByRole("checkbox", { name: "Select task" }).click({ modifiers: ["Shift"] });
    await expect(bar.getByText("4 selected")).toBeVisible();
    await cell(1).click({ modifiers: ["ControlOrMeta"] });
    await expect(bar.getByText("3 selected")).toBeVisible();
    await cell(4).click({ modifiers: ["Shift"] });
    await expect(bar.getByText("5 selected")).toBeVisible();
    // Selecting never opens the panel
    await expect(page).not.toHaveURL(/[?&]task=/);

    // A row's own menu isn't a row click
    const name = (await rows.nth(2).getByRole("button", { name: /^(From a weekly routine )?Range \d$/ }).innerText()).trim();
    await rows.nth(2).getByRole("button", { name: new RegExp(`^Change status of ${name}`) }).click();
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]task=/);

    await cell(2).click();
    await expect(page).toHaveURL(/[?&]task=/);
    await expect(page.getByRole("dialog", { name })).toBeVisible();
    await page.keyboard.press("Escape");
});

test("quick date chips in the new-task form", async () => {
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const quick = dialog.getByRole("group", { name: "Quick dates" });
    await expect(quick.getByRole("button", { name: "Today" })).toHaveAttribute("aria-pressed", "true");
    await quick.getByRole("button", { name: "Tomorrow" }).click();
    await expect(quick.getByRole("button", { name: "Tomorrow" })).toHaveAttribute("aria-pressed", "true");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
    await expect(dialog.locator('input[type="date"]').first()).toHaveValue(iso);
    await page.keyboard.press("Escape");
});

test("? shows the keyboard shortcuts; My work lists tomorrow's tasks", async () => {
    await createTask(admin.api, { workspaceId: workspace.$id, projectId, assigneeId: memberId, name: "Due tomorrow", dueDate: localNoon(1) });
    await page.goto(`/workspaces/${workspace.$id}`, { timeout: 90_000 });
    await page.locator("body").click({ position: { x: 900, y: 10 } });
    await page.keyboard.press("?");
    const shortcuts = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(shortcuts.getByText("Quick jump to a page, project or task")).toBeVisible();
    await page.keyboard.press("Escape");

    await expect(page.getByText(/^Tomorrow \(\d+\)$/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Due tomorrow/ })).toBeVisible();
});
