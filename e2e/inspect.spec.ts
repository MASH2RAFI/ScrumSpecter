import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// Visual inspector: every page, menu, dialog and selection state, in light and dark, at desktop and
// phone size, for a side-by-side report (scripts/inspect-report.mjs). Only runs when INSPECT=<folder>.
test.skip(!process.env.INSPECT, "set INSPECT=<folder> to capture the inspector screens");

type Scene = {
    id: string;
    group: string;
    title: string;
    note: string;
    path: string;
    // Signed out
    public?: boolean;
    act?: (page: Page, mobile: boolean) => Promise<void>;
};

const VIEWS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;
const THEMES = ["light", "dark"] as const;

test("inspector screens", async ({ browser, baseURL }) => {
    test.setTimeout(1_800_000);
    const out = process.env.INSPECT!;
    mkdirSync(out, { recursive: true });

    // A workspace with something everywhere: two projects, teammates and a placeholder, tasks in
    // every status (overdue, timed, starred, several on one day), a routine, a pending request
    const user = await registerUser(baseURL!, "Ines Inspector");
    const teammate = await registerUser(baseURL!, "Theo Teammate");
    const workspace = await createWorkspace(user.api, "Inspector WS");
    const ws = workspace.$id;
    const website = (await createProject(user.api, ws, "Website", 14)).$id;
    const mobileApp = (await createProject(user.api, ws, "Mobile app", 14)).$id;
    expect((await teammate.api.post(`/api/workspaces/${ws}/join`, { data: { code: workspace.inviteCode } })).status()).toBe(200);
    expect((await user.api.post("/api/members/placeholders", { data: { workspaceId: ws, name: "Pat Placeholder" } })).status()).toBe(200);
    const people = await getMembers(user.api, ws) as { $id: string; name: string }[];
    const me = people.find((p) => p.name === "Ines Inspector")!.$id;
    const mate = people.find((p) => p.name === "Theo Teammate")!.$id;
    const pat = people.find((p) => p.name === "Pat Placeholder")!.$id;

    const at = (days: number, hour?: number) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        if (hour === undefined) date.setHours(0, 0, 0, 0); else date.setHours(hour, 0, 0, 0);
        return date.toISOString();
    };
    const tasks: [string, string, string[], string, number, number?][] = [
        ["Hero section", website, [me], "IN_PROGRESS", 0, 10],
        ["Pricing table", website, [mate], "TODO", 1, 14],
        ["Release notes", website, [me], "DONE", -1],
        ["Fix login bug", mobileApp, [me], "TODO", -2],
        ["Onboarding copy", website, [mate, me], "IN_REVIEW", 0, 15],
        ["Dark mode icons", mobileApp, [pat], "BACKLOG", 3],
        ["Store screenshots", mobileApp, [me, pat], "TODO", 2, 11],
        ["Accessibility audit", website, [mate], "IN_REVIEW", -3],
        // Several on one day: a busy month cell
        ["Copy review", website, [me], "TODO", 4],
        ["QA pass", website, [mate], "TODO", 4],
        ["Analytics events", mobileApp, [me], "TODO", 4],
        ["Press kit", website, [pat], "TODO", 4],
        ["Launch email", website, [me], "TODO", 4],
    ];
    for (const [name, projectId, assigneeIds, status, day, hour] of tasks) {
        const startAt = hour === undefined ? undefined : at(day, hour);
        await createTask(user.api, { workspaceId: ws, projectId, name, assigneeIds, status, dueDate: at(day), ...(startAt && { startAt, durationMinutes: 60 }) });
    }
    await createTask(user.api, { workspaceId: ws, projectId: website, name: "Unscheduled idea", assigneeIds: [me], dueDate: undefined });
    const routine = await user.api.post("/api/routines", { data: { workspaceId: ws, projectId: website, name: "Weekly report", assigneeIds: [me], weekdays: [1, 4] } });
    expect(routine.status()).toBe(200);
    const routineId = (await routine.json()).data.$id;
    const list = (await (await user.api.get(`/api/tasks?workspaceId=${ws}`)).json()).data.documents as { $id: string; name: string }[];
    const hero = list.find((task) => task.name === "Hero section")!.$id;
    await user.api.post("/api/stars", { data: { taskId: hero } });
    await user.api.post("/api/stars", { data: { routineId } });
    // A pending request from the teammate (it also puts a notification in the bell)
    expect((await teammate.api.post("/api/change-requests", {
        data: { kind: "create", workspaceId: ws, changes: { name: "Write FAQ", projectId: website, assigneeIds: [mate] } },
    })).status()).toBe(200);

    const base = `/workspaces/${ws}`;
    const tasksPage = `${base}/tasks`;
    const filterPrefs = (data: Record<string, unknown>) => user.api.patch("/api/account/preferences", { data });
    const openFilters = async (page: Page, mobile: boolean) => { if (mobile) await page.getByRole("button", { name: /^Filters/ }).click(); };
    const openMobileMenu = async (page: Page) => { await page.getByRole("button", { name: /menu/i }).first().click(); };
    const dragTo = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
        await page.mouse.move(from.x, from.y);
        await page.mouse.down();
        await page.mouse.move(from.x, from.y + 20, { steps: 5 });
        await page.mouse.move(to.x, to.y, { steps: 15 });
        await page.waitForTimeout(400);
    };
    const centre = async (page: Page, selector: Parameters<Page["locator"]>[0]) => {
        const box = (await page.locator(selector).first().boundingBox())!;
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };

    const scenes: Scene[] = [
        // Signed out
        { id: "about", group: "Signed out", title: "About page", note: "The public landing page.", path: "/about", public: true },
        { id: "sign-in", group: "Signed out", title: "Sign in", note: "Email and password, or Google.", path: "/sign-in", public: true },
        { id: "sign-up", group: "Signed out", title: "Sign up", note: "New account form.", path: "/sign-up", public: true },

        // Home
        { id: "home", group: "Home", title: "Home", note: "Stat cards, week chart, sprint donut, My work, team and projects.", path: base },
        {
            id: "home-following", group: "Home", title: "Home following the My Tasks filter",
            note: "With a My Tasks filter saved (here Me + Starred), Home applies it and says so; My work stays your own.",
            path: base,
            act: async (page) => {
                await filterPrefs({ taskFilters: { [ws]: { people: ["me"], statuses: [], starred: true, overdue: false } } });
                await page.reload();
                await page.getByTestId("home-following").waitFor();
                await filterPrefs({ taskFilters: {} });
            },
        },

        // My Tasks: table and the filter block
        { id: "tasks-table", group: "My Tasks", title: "Table", note: "The table with the filter block (Everyone, All).", path: `${tasksPage}?task-view=table` },
        {
            id: "filter-block", group: "My Tasks", title: "Filter block, several chips on",
            note: "Me + Theo Teammate, To Do + In Review, Starred off. Counts follow the other rows. Phones: the rows open behind Filters.",
            path: `${tasksPage}?task-view=table`,
            act: async (page, mobile) => {
                await filterPrefs({ taskFilters: { [ws]: { people: ["me", mate], statuses: ["TODO", "IN_REVIEW"], starred: false, overdue: false } } });
                await page.reload();
                await openFilters(page, mobile);
                await page.getByTestId("task-filters").waitFor();
                await filterPrefs({ taskFilters: {} });
            },
        },
        {
            id: "search-shortcut", group: "My Tasks", title: "Search in plain words", note: "\"theo in review\" narrows to Theo's tasks in review; the line under the box says how it was read.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => { await page.getByLabel("Search tasks").fill("theo in review"); await page.waitForTimeout(800); },
        },
        {
            id: "sort-menu", group: "My Tasks", title: "Sort menu", note: "Newest, due date, name, story points (saved on the account).",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => { await page.getByRole("combobox", { name: "Sort" }).click(); },
        },
        {
            id: "table-selection", group: "My Tasks", title: "Rows selected, bulk bar", note: "Ticking rows shows the bulk bar.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => {
                const boxes = page.getByRole("checkbox", { name: "Select task" });
                await boxes.nth(0).click();
                await boxes.nth(1).click();
            },
        },
        {
            id: "row-actions", group: "My Tasks", title: "Row actions menu", note: "Open, open project, edit, delete.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => { await page.getByRole("button", { name: "Actions for Hero section" }).first().click(); },
        },
        {
            id: "row-status", group: "My Tasks", title: "Row status menu", note: "The statuses this person may set.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => { await page.getByRole("button", { name: /change status of Pricing table/ }).first().click(); },
        },
        {
            id: "export-menu", group: "My Tasks", title: "Export menu", note: "CSV, .ics and the calendar subscribe link.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => { await page.getByRole("button", { name: /Export/ }).first().click(); },
        },
        {
            id: "new-task", group: "My Tasks", title: "New task form, project picker open", note: "The form's project menu, with No project.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => {
                await page.getByRole("button", { name: /^New/ }).first().click();
                await page.getByRole("dialog").getByRole("combobox").filter({ hasText: "Select project" }).click();
            },
        },

        // Kanban
        { id: "kanban", group: "Kanban", title: "Kanban", note: "Columns by status, star and menu on each card.", path: `${tasksPage}?task-view=kanban` },
        {
            id: "kanban-card-menu", group: "Kanban", title: "Card menu", note: "A card's actions.",
            path: `${tasksPage}?task-view=kanban`,
            // Exactly: the whole card is also a button (for dragging) whose name includes this text
            act: async (page) => { await page.getByRole("button", { name: "Actions for Hero section", exact: true }).click(); },
        },
        {
            id: "kanban-bin", group: "Kanban", title: "Dragging a card to the bin", note: "The bin on the right turns red under a card.",
            path: `${tasksPage}?task-view=kanban`,
            act: async (page, mobile) => {
                if (mobile) return;
                await dragTo(page, await centre(page, '[data-rfd-draggable-id]:has-text("Pricing table")'), await centre(page, '[data-testid="drop-bin"]'));
            },
        },
        {
            id: "kanban-compact", group: "Kanban", title: "Compact cards, narrow empty columns", note: "Both Kanban settings on.",
            path: `${tasksPage}?task-view=kanban`,
            act: async (page) => {
                await filterPrefs({ kanbanCompact: true, kanbanShrinkEmpty: true });
                await page.reload();
                await page.locator("[data-rfd-draggable-id]").first().waitFor();
                await filterPrefs({ kanbanCompact: false, kanbanShrinkEmpty: false });
            },
        },

        // Calendar
        { id: "calendar-month", group: "Calendar", title: "Month", note: "Month cards (busy days grow to fit), the Unscheduled panel.", path: `${tasksPage}?task-view=calendar&cal=month` },
        { id: "calendar-week", group: "Calendar", title: "Week", note: "Timed blocks, the all-day row, days off.", path: `${tasksPage}?task-view=calendar&cal=week` },
        { id: "calendar-day", group: "Calendar", title: "Day", note: "One day's time grid.", path: `${tasksPage}?task-view=calendar&cal=day` },
        {
            id: "calendar-select", group: "Calendar", title: "Selecting time", note: "Dragging down a day selects time slots.",
            path: `${tasksPage}?task-view=calendar&cal=week`,
            act: async (page) => {
                const box = (await page.locator(".rbc-time-content .rbc-day-slot").nth(4).boundingBox())!;
                await page.mouse.move(box.x + box.width / 2, box.y + 60);
                await page.mouse.down();
                await page.mouse.move(box.x + box.width / 2, box.y + 260, { steps: 10 });
                await page.waitForTimeout(300);
            },
        },
        {
            id: "calendar-settings", group: "Calendar", title: "View settings", note: "Row size, visible hours, the Unscheduled panel.",
            path: `${tasksPage}?task-view=calendar&cal=week`,
            act: async (page) => { await page.getByRole("button", { name: "View settings" }).click(); },
        },
        {
            id: "calendar-bin", group: "Calendar", title: "Dragging a task to the bin", note: "Week grid tasks, month cards and Unscheduled cards can go to the bin.",
            path: `${tasksPage}?task-view=calendar&cal=week`,
            act: async (page, mobile) => {
                if (mobile) return;
                const event = (await page.locator(".rbc-time-content .rbc-event").first().boundingBox())!;
                await dragTo(page, { x: event.x + event.width / 2, y: event.y + 8 }, await centre(page, '[data-testid="drop-bin"]'));
            },
        },

        // Tasks in detail
        {
            id: "task-panel", group: "Task", title: "Task panel", note: "Opened from the table.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => { await page.getByRole("button", { name: "Hero section", exact: true }).first().click(); },
        },
        {
            id: "edit-over-panel", group: "Task", title: "Edit dialog over the panel", note: "Escape closes the dialog first, then the panel.",
            path: `${tasksPage}?task-view=table`,
            act: async (page) => {
                await page.getByRole("button", { name: "Hero section", exact: true }).first().click();
                await page.getByRole("dialog", { name: "Hero section" }).getByRole("button", { name: "Edit", exact: true }).first().click();
                await page.getByRole("dialog", { name: /Edit/ }).waitFor();
            },
        },
        { id: "task-page", group: "Task", title: "Task page", note: "The full page for a task.", path: `${tasksPage}/${hero}` },

        // Routines, requests, projects
        { id: "routines", group: "Routines", title: "Routines", note: "Week overview, routine cards, its own filter.", path: `${base}/routines` },
        {
            id: "routines-filter", group: "Routines", title: "Routines filter on", note: "Me + Starred: only starred routines of mine.",
            path: `${base}/routines`,
            act: async (page) => {
                await filterPrefs({ routineFilters: { [ws]: { people: ["me"], tags: ["starred"] } } });
                await page.reload();
                await page.getByTestId("routine-filters").waitFor();
                await filterPrefs({ routineFilters: {} });
            },
        },
        {
            id: "routine-form", group: "Routines", title: "New routine form", note: "Days, time, people, views.",
            path: `${base}/routines`,
            act: async (page) => { await page.getByRole("button", { name: /New routine/ }).first().click(); },
        },
        { id: "requests", group: "Requests", title: "Requests", note: "A pending request from Theo, with Approve / Decline.", path: `${base}/requests` },
        { id: "projects", group: "Projects", title: "Projects", note: "Every project with its sprint.", path: `${base}/projects` },
        { id: "project-page", group: "Projects", title: "A project's page", note: "The project's tasks, with the same filter block (no eyes).", path: `${base}/projects/${website}` },

        // Analytics
        { id: "analytics-capacity", group: "Analytics", title: "Capacity calculator", note: "Pick a project to fill it.", path: `${base}/analytics` },
        {
            id: "analytics-burndown", group: "Analytics", title: "Burndown chart", note: "Generated for Website.",
            path: `${base}/analytics`,
            act: async (page) => {
                await page.getByRole("tab", { name: /Burndown/ }).click();
                await page.getByRole("combobox").filter({ hasText: "Select a project" }).click();
                await page.getByRole("option", { name: "Website" }).click();
                await page.getByRole("button", { name: "Generate Burndown Chart" }).click();
                await page.waitForTimeout(1500);
            },
        },
        {
            id: "analytics-velocity", group: "Analytics", title: "Velocity tracker", note: "Velocity by project.",
            path: `${base}/analytics`,
            act: async (page) => { await page.getByRole("tab", { name: /Velocity/ }).click(); await page.waitForTimeout(1200); },
        },
        {
            id: "analytics-report", group: "Analytics", title: "Sprint report", note: "The report for Website.",
            path: `${base}/analytics`,
            act: async (page) => {
                await page.getByRole("tab", { name: /Sprint Report/ }).click();
                await page.getByRole("combobox").filter({ hasText: /Select/ }).first().click();
                await page.getByRole("option", { name: "Website" }).click();
            },
        },

        // Workspace popups
        { id: "members", group: "Workspace", title: "Members popup", note: "Everyone in the workspace, roles, placeholders.", path: `${base}?workspace-panel=members` },
        {
            id: "member-options", group: "Workspace", title: "A member's options", note: "Role and remove.",
            path: `${base}?workspace-panel=members`,
            act: async (page) => { await page.getByRole("button", { name: "Options for Pat Placeholder" }).click(); },
        },
        { id: "settings", group: "Workspace", title: "Workspace settings", note: "General tab.", path: `${base}?workspace-panel=settings` },
        {
            id: "settings-bulk", group: "Workspace", title: "Bulk input", note: "Commands, check and apply; Copy AI prompt.",
            path: `${base}?workspace-panel=settings`,
            act: async (page) => { await page.getByRole("tab", { name: "Bulk input" }).click(); },
        },
        { id: "create-workspace", group: "Workspace", title: "Getting started", note: "Create, join or set up from bulk commands.", path: "/workspaces/create" },

        // Account and navigation
        { id: "account-profile", group: "Account", title: "Account: profile", note: "Name, email, avatar.", path: "/account" },
        { id: "account-security", group: "Account", title: "Account: security", note: "Password, Google, signed-in devices.", path: "/account?tab=security" },
        { id: "account-preferences", group: "Account", title: "Account: preferences", note: "Display, My Tasks, Kanban, Calendar.", path: "/account?tab=preferences" },
        {
            id: "notifications", group: "Navigation", title: "Notifications (bell)", note: "The new request shows here.",
            path: base,
            act: async (page) => { await page.getByRole("button", { name: /^Notifications/ }).first().click(); },
        },
        {
            id: "quick-jump", group: "Navigation", title: "Quick jump", note: "Ctrl K with a search typed.",
            path: base,
            act: async (page) => {
                await page.keyboard.press("Control+k");
                await page.getByRole("dialog", { name: "Quick jump" }).getByRole("textbox").fill("re");
                await page.keyboard.press("ArrowDown");
            },
        },
        {
            id: "shortcuts", group: "Navigation", title: "Keyboard shortcuts", note: "Press ? anywhere.",
            path: base,
            act: async (page) => { await page.keyboard.press("Shift+Slash"); },
        },
        {
            id: "workspace-switcher", group: "Navigation", title: "Workspace switcher", note: "Desktop: sidebar stays open while it's open. Phones: inside the menu.",
            path: base,
            act: async (page, mobile) => {
                if (mobile) { await openMobileMenu(page); await page.getByRole("dialog").getByRole("combobox").first().click(); return; }
                await page.mouse.move(30, 300, { steps: 5 });
                await page.locator("aside[data-collapsed]").first().getByRole("combobox").click();
            },
        },
        {
            id: "account-menu", group: "Navigation", title: "Account menu", note: "Settings, the tour, theme, sign out.",
            path: base,
            act: async (page) => { await page.getByRole("button", { name: "Account menu" }).click(); },
        },
        {
            id: "tour", group: "Navigation", title: "Welcome tour", note: "Started from the account menu.",
            path: base,
            act: async (page) => {
                await page.getByRole("button", { name: "Account menu" }).click();
                await page.getByRole("menuitem", { name: "Take the tour" }).click();
                await page.getByRole("button", { name: "Show me around" }).click();
            },
        },
    ];

    type Shot = { theme: string; view: string; file: string };
    type Entry = { id: string; group: string; title: string; note: string; shots: Shot[] };
    // INSPECT_ONLY=id,id retakes just those scenes and keeps the rest of an earlier run
    const only = process.env.INSPECT_ONLY?.split(",").map((id) => id.trim()).filter(Boolean);
    const earlier: Entry[] = only && existsSync(join(out, "manifest.json")) ? JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).scenes : [];
    const manifest: Entry[] = [];
    for (const scene of scenes) {
        if (only && !only.includes(scene.id)) {
            const kept = earlier.find((entry) => entry.id === scene.id);
            if (kept) manifest.push(kept);
            continue;
        }
        const shots: Shot[] = [];
        for (const theme of THEMES) {
            for (const [view, viewport] of Object.entries(VIEWS)) {
                const context = await browser.newContext({ viewport, deviceScaleFactor: 1, timezoneId: "Asia/Dhaka", colorScheme: theme });
                const page = await context.newPage();
                // A step that can't find its element gives up quickly; the screenshot still shows the state
                page.setDefaultTimeout(8_000);
                if (!scene.public) await signInBrowser(page, user, baseURL!);
                await page.goto(scene.path, { timeout: 90_000 });
                await page.waitForTimeout(1200);
                try {
                    await scene.act?.(page, view === "mobile");
                } catch (error) {
                    console.log(`inspector: ${scene.id} (${theme} ${view}) step failed: ${(error as Error).message.split("\n")[0]}`);
                }
                await page.waitForTimeout(600);
                const file = `${scene.id}-${theme}-${view}.jpg`;
                await page.screenshot({ path: join(out, file), type: "jpeg", quality: 72 });
                shots.push({ theme, view, file });
                await context.close();
            }
        }
        manifest.push({ id: scene.id, group: scene.group, title: scene.title, note: scene.note, shots });
    }
    writeFileSync(join(out, "manifest.json"), JSON.stringify({ taken: new Date().toISOString(), scenes: manifest }, null, 2));
});
