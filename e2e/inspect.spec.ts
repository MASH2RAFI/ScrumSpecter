import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser } from "./helpers";

// Visual inspector: the screens being worked on, at desktop and phone size, for a side-by-side
// report (scripts/inspect-report.mjs). Only runs when INSPECT=<folder> is set.
test.skip(!process.env.INSPECT, "set INSPECT=<folder> to capture the inspector screens");

type Scene = { id: string; title: string; note: string; path: string; act?: (page: Page, mobile: boolean) => Promise<void> };

const VIEWS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } } as const;

test("inspector screens", async ({ browser, baseURL }) => {
    test.setTimeout(600_000);
    const out = process.env.INSPECT!;
    mkdirSync(out, { recursive: true });

    const user = await registerUser(baseURL!, "Ines Inspector");
    const workspace = await createWorkspace(user.api, "Inspector WS");
    const ws = workspace.$id;
    const projectId = (await createProject(user.api, ws, "Website", 14)).$id;
    const me = (await getMembers(user.api, ws))[0].$id;
    for (const [name, status] of [["Hero section", "IN_PROGRESS"], ["Pricing table", "TODO"], ["Release notes", "DONE"]]) {
        await createTask(user.api, { workspaceId: ws, projectId, assigneeId: me, name, status });
    }

    // The screens under work; edit this list as the work moves on
    const prefs = (data: Record<string, unknown>) => user.api.patch("/api/account/preferences", { data });
    const routine = await user.api.post("/api/routines", { data: { workspaceId: ws, projectId, name: "Weekly report", assigneeIds: [me], weekdays: [1, 4] } });
    expect(routine.status()).toBe(200);
    const scenes: Scene[] = [
        {
            id: "kanban-bin", title: "Kanban: dragging a card to the bin",
            note: "§32: while a card is dragged, the bin fades in at the bottom; held over it, it turns red, and dropping deletes the task with Undo. On phones the menu is the way to delete.",
            path: `/workspaces/${ws}/tasks?task-view=kanban`,
            act: async (page, mobile) => {
                if (mobile) return;
                const card = page.locator("[data-rfd-draggable-id]").filter({ hasText: "Pricing table" });
                const from = (await card.boundingBox())!;
                await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
                await page.mouse.down();
                await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 20, { steps: 5 });
                const bin = (await page.getByTestId("drop-bin").boundingBox())!;
                await page.mouse.move(bin.x + bin.width / 2, bin.y + bin.height / 2, { steps: 15 });
                await page.waitForTimeout(400);
            },
        },
        {
            id: "routines-bin", title: "Routines: cards that drag to the bin",
            note: "§32: routine cards can be dragged to the same bin (it asks before deleting). Shown here at rest, with the grab cursor on the cards.",
            path: `/workspaces/${ws}/routines`,
            act: async (page) => { await page.locator("[draggable=true]").first().scrollIntoViewIfNeeded(); },
        },
        {
            id: "settings-preferences", title: "Account settings: the new preferences",
            note: "§7: Date format, and the new My Tasks (sort, tasks per page, Done tasks) and Kanban (compact cards, narrow empty columns) sections.",
            path: "/account?tab=preferences",
            act: async (page) => { await page.getByText("Kanban", { exact: true }).first().scrollIntoViewIfNeeded(); },
        },
        {
            id: "kanban-compact", title: "Kanban: compact cards, narrow empty columns",
            note: "§7: with both Kanban options on, cards show the name only and the empty columns shrink to a strip (they still take drops).",
            path: `/workspaces/${ws}/tasks?task-view=kanban`,
            act: async (page, mobile) => {
                await prefs({ kanbanCompact: true, kanbanShrinkEmpty: true });
                await page.reload();
                await page.locator("[data-rfd-draggable-id]").first().waitFor();
                if (mobile) await prefs({ kanbanCompact: false, kanbanShrinkEmpty: false });
            },
        },
        {
            id: "table-defaults", title: "My Tasks table: ISO dates, sorted by name, Done hidden",
            note: "§7: date format ISO, starting sort Name A to Z, Done tasks hidden (Release notes is Done, so it's left out).",
            path: `/workspaces/${ws}/tasks?task-view=table`,
            act: async (page, mobile) => {
                await prefs({ dateFormat: "iso", taskSort: "name", showDoneInTable: false });
                await page.reload();
                await page.locator("tbody tr").first().waitFor();
                if (mobile) await prefs({ dateFormat: "long", taskSort: "newest", showDoneInTable: true });
            },
        },
        {
            id: "edit-over-panel", title: "Edit dialog over the task panel",
            note: "Fixed today: Escape here closes the Edit dialog, not the panel underneath (it used to close the panel in production builds), and closing a dialog hands focus back to what opened it.",
            path: `/workspaces/${ws}/tasks?task-view=table`,
            act: async (page) => {
                await page.getByRole("button", { name: "Hero section", exact: true }).first().click();
                await page.getByRole("dialog", { name: "Hero section" }).getByRole("button", { name: "Edit", exact: true }).first().click();
                await page.getByRole("dialog", { name: /Edit/ }).waitFor();
            },
        },
        {
            id: "analytics", title: "Analytics: charts with screen-reader tables",
            note: "§27: the burndown and velocity charts are hidden from screen readers and each has a text table instead (invisible on screen; nothing should look different).",
            path: `/workspaces/${ws}/analytics`,
            act: async (page) => {
                await page.getByRole("combobox").filter({ hasText: "Select a project" }).click();
                await page.getByRole("option", { name: "Website" }).click();
                await page.getByRole("button", { name: "Generate Burndown Chart" }).click();
                await page.waitForTimeout(1500);
            },
        },
    ];

    const manifest: { id: string; title: string; note: string; shots: Record<string, string> }[] = [];
    for (const scene of scenes) {
        const shots: Record<string, string> = {};
        for (const [view, viewport] of Object.entries(VIEWS)) {
            const context = await browser.newContext({ viewport, deviceScaleFactor: 1, timezoneId: "Asia/Dhaka" });
            const page = await context.newPage();
            // A step that can't find its element gives up quickly; the screenshot still shows the state
            page.setDefaultTimeout(10_000);
            await signInBrowser(page, user, baseURL!);
            await page.goto(scene.path, { timeout: 90_000 });
            await page.waitForTimeout(1200);
            try {
                await scene.act?.(page, view === "mobile");
            } catch (error) {
                console.log(`inspector: ${scene.id} (${view}) step failed: ${(error as Error).message.split("\n")[0]}`);
            }
            await page.waitForTimeout(600);
            const file = `${scene.id}-${view}.png`;
            await page.screenshot({ path: join(out, file) });
            shots[view] = file;
            await context.close();
        }
        manifest.push({ id: scene.id, title: scene.title, note: scene.note, shots });
    }
    writeFileSync(join(out, "manifest.json"), JSON.stringify({ taken: new Date().toISOString(), scenes: manifest }, null, 2));
});
