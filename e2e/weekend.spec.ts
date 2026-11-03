import { expect, test } from "@playwright/test";

import { createWorkspace, registerUser, signInBrowser, watchConsole, type TestUser } from "./helpers";

// A workspace picks its own weekend in Settings → Holidays (else its holiday country's), and the
// calendar labels those days
test.describe.configure({ mode: "serial" });

let admin: TestUser, assignee: TestUser;
let workspaceId: string;

const weekend = async () => {
    const res = await admin.api.get(`/api/workspaces/${workspaceId}/holidays?from=2026-01-01&to=2026-01-31`);
    expect(res.status(), await res.text()).toBe(200);
    const { weekend: days, customWeekend } = (await res.json()).data as { weekend: number[]; customWeekend: boolean };
    return { days, customWeekend };
};

const setWeekend = (who: TestUser, weekendDays: string) =>
    who.api.patch(`/api/workspaces/${workspaceId}`, { multipart: { weekendDays } });

test.beforeAll(async ({ baseURL }) => {
    admin = await registerUser(baseURL!, "Weekend Wren");
    assignee = await registerUser(baseURL!, "Weekday Wes");
    const workspace = await createWorkspace(admin.api, "Weekend WS");
    workspaceId = workspace.$id;
    await assignee.api.post(`/api/workspaces/${workspaceId}/join`, { data: { code: workspace.inviteCode } });
});

test("API: the country's weekend until one is picked; none, reset and bad input", async () => {
    // New workspaces use Bangladesh: Friday and Saturday
    expect(await weekend()).toEqual({ days: [5, 6], customWeekend: false });

    expect((await setWeekend(admin, "0,5,5")).status()).toBe(200);
    expect(await weekend()).toEqual({ days: [0, 5], customWeekend: true });
    expect((await setWeekend(admin, "")).status()).toBe(200);
    expect(await weekend()).toEqual({ days: [], customWeekend: true });
    expect((await setWeekend(admin, "country")).status()).toBe(200);
    expect(await weekend()).toEqual({ days: [5, 6], customWeekend: false });

    expect((await setWeekend(admin, "7")).status()).toBe(400);
    expect((await setWeekend(admin, "fri")).status()).toBe(400);
    // Admins only (others get 401, like every workspace-management call)
    expect((await setWeekend(assignee, "0")).status()).toBe(401);
    expect((await weekend()).customWeekend).toBe(false);
});

test("Settings: toggling days changes the calendar's weekend labels", async ({ page, baseURL }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspaceId}?workspace-panel=settings`, { timeout: 90_000 });
    const settings = page.getByRole("dialog", { name: "Workspace settings" });
    await settings.getByRole("tab", { name: "Holidays" }).click();

    const days = settings.getByRole("group", { name: "Weekend" });
    await expect(days.getByRole("button", { name: "Friday" })).toHaveAttribute("aria-pressed", "true");
    await expect(days.getByRole("button", { name: "Sunday" })).toHaveAttribute("aria-pressed", "false");
    // Saturday off, Sunday on: Friday and Sunday
    await days.getByRole("button", { name: "Saturday" }).click();
    await expect(days.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "false");
    await days.getByRole("button", { name: "Sunday" }).click();
    await expect(days.getByRole("button", { name: "Sunday" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await weekend()).days).toEqual([0, 5]);
    await expect(settings.getByRole("button", { name: "Use the country's weekend" })).toBeVisible();
    await page.keyboard.press("Escape");

    // The week view labels exactly two days: Friday and Sunday
    await page.goto(`/workspaces/${workspaceId}/tasks?task-view=calendar&cal=week`, { timeout: 90_000 });
    const labels = page.locator(".rbc-time-header .holiday-label", { hasText: "Weekend" });
    await expect(labels).toHaveCount(2);
    // Each label sits under its day's header: match them by position
    const headerBoxes = await page.locator(".rbc-time-header .rbc-header").evaluateAll((cells) =>
        cells.map((cell) => ({ text: (cell as HTMLElement).innerText.slice(0, 3), ...cell.getBoundingClientRect().toJSON() })));
    const labelled = await labels.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return r.x + r.width / 2; }));
    expect(labelled.map((x) => headerBoxes.find((h) => x >= h.x && x <= h.x + h.width)?.text).sort()).toEqual(["Fri", "Sun"]);

    // Back to the country's
    await page.goto(`/workspaces/${workspaceId}?workspace-panel=settings`, { timeout: 90_000 });
    await settings.getByRole("tab", { name: "Holidays" }).click();
    await settings.getByRole("button", { name: "Use the country's weekend" }).click();
    await expect.poll(async () => await weekend()).toEqual({ days: [5, 6], customWeekend: false });
    await expect(days.getByRole("button", { name: "Saturday" })).toHaveAttribute("aria-pressed", "true");
    expect(errors, errors.join("\n")).toEqual([]);
});
