import { expect, test } from "@playwright/test";

import { sql, createProject, createWorkspace, getMembers, registerUser, signInBrowser, watchConsole } from "./helpers";

// A routine's time and weekdays are in the zone it was made in. The week overview shows each run on
// the weekday and hour it really has for the viewer, like the tasks the routine creates.
test("routine week: a Los Angeles evening run shows on the next morning for a viewer in Dhaka", async ({ browser, baseURL }) => {
    const admin = await registerUser(baseURL!, "Zone Zed");
    const workspace = await createWorkspace(admin.api, "Zone WS");
    const project = await createProject(admin.api, workspace.$id, "Zone project");
    const [me] = await getMembers(admin.api, workspace.$id);
    const made = await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Evening check", projectId: project.$id, assigneeIds: [me.$id], weekdays: [1], startTime: "20:00", timeZone: "America/Los_Angeles", durationMinutes: 30 },
    });
    expect(made.status(), await made.text()).toBe(200);
    // Same routine in its own zone, for comparison
    await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name: "Local check", projectId: project.$id, assigneeIds: [me.$id], weekdays: [1], startTime: "09:30", timeZone: "Asia/Dhaka", durationMinutes: 30 },
    });

    // Monday 20:00 in Los Angeles is Tuesday morning in Dhaka (UTC+6, 14 hours ahead, 13 in summer)
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dhaka" });
    const errors = watchConsole(page);
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    const week = page.getByLabel("Routines by weekday");
    await expect(week.getByRole("region", { name: "Tuesday" }).getByText("Evening check")).toBeVisible();
    await expect(week.getByRole("region", { name: "Monday" }).getByText("Evening check")).toHaveCount(0);
    // A routine made in the viewer's own zone stays where it was
    await expect(week.getByRole("region", { name: "Monday" }).getByText("Local check")).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// A run that goes past midnight is drawn on both days: its evening on its own day, the rest on the next
test("routine week: a late-evening run continues on the next weekday", async ({ browser, baseURL }) => {
    const admin = await registerUser(baseURL!, "Late Lea");
    const workspace = await createWorkspace(admin.api, "Late WS");
    const project = await createProject(admin.api, workspace.$id, "Late project");
    const [me] = await getMembers(admin.api, workspace.$id);
    const make = (name: string, weekdays: number[]) => admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name, projectId: project.$id, assigneeIds: [me.$id], weekdays, startTime: "23:00", timeZone: "Asia/Dhaka", durationMinutes: 120 },
    });
    // Monday only, and Sunday through Monday (Sunday's run reaches into Monday, next to Monday's own)
    expect((await make("Night shift", [1])).status()).toBe(200);
    expect((await make("Daily watch", [7, 1])).status()).toBe(200);

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dhaka" });
    const errors = watchConsole(page);
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    const week = page.getByLabel("Routines by weekday");
    const day = (name: string) => week.getByRole("region", { name });
    await expect(day("Monday").getByText("Night shift")).toBeVisible();
    await expect(day("Tuesday").getByText("Night shift")).toBeVisible();
    await expect(day("Wednesday").getByText("Night shift")).toHaveCount(0);
    // Monday holds Sunday's tail and Monday's own start of the same routine
    await expect(day("Monday").getByText("Daily watch")).toHaveCount(2);
    await expect(day("Tuesday").getByText("Daily watch")).toHaveCount(1);
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();
});

// A start time without a zone used to be made at UTC (hours off for whoever set it) while the Routines page
// drew it in the viewer's zone. The API now fills in the person's own zone, and a routine that still has none
// is drawn the way its tasks are made: at UTC.
test("routines: a start time gets the person's zone; an older routine without one is drawn at UTC", async ({ browser, baseURL }) => {
    const admin = await registerUser(baseURL!, "Zone Zoe");
    const workspace = await createWorkspace(admin.api, "Zoneless WS");
    const project = await createProject(admin.api, workspace.$id, "Zoneless project");
    const [me] = await getMembers(admin.api, workspace.$id);
    const make = async (name: string) => (await (await admin.api.post("/api/routines", {
        data: { workspaceId: workspace.$id, name, projectId: project.$id, assigneeIds: [me.$id], weekdays: [1], startTime: "09:30", durationMinutes: 30 },
    })).json()).data;

    // New: the person's own zone (Dhaka by default), so 09:30 stays 09:30 for them
    const fresh = await make("Fresh");
    expect(fresh.timeZone).toBe("Asia/Dhaka");

    // Older: no zone stored. Its tasks are at UTC, and so is the drawing (09:30 UTC = 3:30 PM in Dhaka)
    const old = await make("Older");
    await sql("update routines set time_zone = null where id = $1", [old.$id]);
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, timezoneId: "Asia/Dhaka" });
    const errors = watchConsole(page);
    await signInBrowser(page, admin, baseURL!);
    await page.goto(`/workspaces/${workspace.$id}/routines`, { timeout: 90_000 });
    const monday = page.getByLabel("Routines by weekday").getByRole("region", { name: "Monday" });
    await expect(monday.getByText("Older")).toBeVisible();
    await expect(monday.getByText("3:30 PM").first()).toBeVisible();
    await expect(monday.getByText("9:30 AM").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
    await page.close();

    // Setting a start time on such a routine gives it the person's zone too
    const fixed = (await (await admin.api.patch(`/api/routines/${old.$id}`, { data: { startTime: "10:00" } })).json()).data;
    expect(fixed.timeZone).toBe("Asia/Dhaka");
});
