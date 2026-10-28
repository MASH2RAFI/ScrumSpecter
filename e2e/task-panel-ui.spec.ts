import { expect, test, type Locator, type Page } from "@playwright/test";

type Point = { x: number; y: number };

import { createProject, createTask, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// Browser: the task side panel opens from every entry point and always closes again, by its X,
// by Escape and by clicking outside (right where the task was, so a click can't fall through)
test.describe.configure({ mode: "serial" });

let page: Page;
let errors: string[];
let user: TestUser;
let workspaceId: string;

const NAME = "Hero section";

test.beforeAll(async ({ browser, baseURL }) => {
    user = await registerUser(baseURL!, "Panel Pat");
    workspaceId = (await createWorkspace(user.api, "Panel")).$id;
    const projectId = (await createProject(user.api, workspaceId, "Website", 14)).$id;
    const [me] = await getMembers(user.api, workspaceId);
    // Today at 10:00 in Dhaka, an hour long: shows in My work, the table, kanban and the calendar
    const dhaka = new Date(Date.now() + 6 * 3_600_000);
    const startAt = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate(), 4)).toISOString();
    const res = await createTask(user.api, { workspaceId, projectId, assigneeId: me.$id, name: NAME, startAt, durationMinutes: 60 });
    expect(res.status(), await res.text()).toBe(200);
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    errors = watchConsole(page);
    await signInBrowser(page, user, baseURL!);
});

test.afterAll(async () => {
    await page.close();
});

test.afterEach(() => {
    expect(errors, errors.join("\n")).toEqual([]);
    errors.length = 0;
});

const panel = () => page.getByRole("dialog", { name: NAME });

const expectClosed = async (how: string) => {
    await expect(panel(), how).toHaveCount(0);
    await expect(page, how).not.toHaveURL(/[?&]task=/);
    // Still closed a moment later (nothing reopened it)
    await page.waitForTimeout(600);
    await expect(panel(), how).toHaveCount(0);
};

// Clicks a task, returning where (the panel then hides the page from the accessibility tree)
const clickAt = async (target: Locator): Promise<Point> => {
    const box = (await target.boundingBox())!;
    await target.click();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// Opens the panel with `open`, then closes it each way
const openAndClose = async (label: string, open: () => Promise<Point | void>) => {
    for (const how of ["close button", "Escape", "outside click"] as const) {
        const trigger = await open();
        await expect(panel(), `${label}: opens`).toBeVisible();
        if (how === "close button") {
            await panel().getByRole("button", { name: "Close" }).click();
        } else if (how === "Escape") {
            await page.keyboard.press("Escape");
        } else {
            // Where the task was clicked when that's left of the panel, else the page's left edge
            const at = trigger && trigger.x < 800 ? trigger : { x: 40, y: 450 };
            await page.mouse.click(at.x, at.y);
        }
        await expectClosed(`${label} → ${how}`);
    }
};

test("from Home's My work", async () => {
    await page.goto(`/workspaces/${workspaceId}`, { timeout: 90_000 });
    await openAndClose("home", async () => {
        return clickAt(page.getByRole("main").getByRole("button", { name: new RegExp(NAME) }).first());
    });
});

test("from the table: the task name and the row menu", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks`, { timeout: 90_000 });
    await openAndClose("table name", async () => {
        return clickAt(page.getByRole("button", { name: NAME, exact: true }).first());
    });
    await openAndClose("row menu", async () => {
        await page.getByRole("row", { name: new RegExp(NAME) }).getByRole("button").last().click();
        await page.getByRole("menuitem", { name: "Task Details" }).click();
    });
});

test("from a kanban card", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=kanban`, { timeout: 90_000 });
    await openAndClose("kanban", async () => {
        return clickAt(page.getByText(NAME, { exact: true }).first());
    });
});

test("from the calendar: week block and month card", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar`, { timeout: 90_000 });
    for (const view of ["week", "month"]) {
        await page.getByRole("button", { name: view, exact: true }).click();
        await openAndClose(`calendar ${view}`, async () => {
            return clickAt(page.locator(".rbc-calendar").getByRole("button", { name: new RegExp(NAME) }).locator("visible=true").first());
        });
    }
});

test("from the quick-jump menu", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks`, { timeout: 90_000 });
    await openAndClose("command palette", async () => {
        await page.keyboard.press("Control+k");
        await page.getByRole("dialog", { name: "Quick jump" }).getByRole("textbox").fill("Hero");
        await page.getByRole("option", { name: new RegExp(NAME) }).click();
    });
});

test("after editing from the panel", async () => {
    await page.goto(`/workspaces/${workspaceId}/tasks`, { timeout: 90_000 });
    await page.getByRole("button", { name: NAME, exact: true }).first().click();
    await expect(panel()).toBeVisible();
    await panel().getByRole("button", { name: "Edit", exact: true }).first().click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /Edit/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expectClosed("after edit");
});
