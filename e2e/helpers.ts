import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const CRON_SECRET = "e2e-cron-secret";

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export type TestUser = { name: string; email: string; password: string; api: APIRequestContext; cookie: string };

// Registers through the API and returns a request context that carries the session cookie.
// The cookie is Secure, which APIRequestContext won't send over http, so it goes in a header.
export const registerUser = async (baseURL: string, name = "Tester"): Promise<TestUser> => {
    const email = `e2e-${unique()}@example.com`;
    const password = "correct-horse-battery";
    const anon = await request.newContext({ baseURL });
    const res = await anon.post("/api/auth/register", { data: { name, email, password } });
    expect(res.status(), await res.text()).toBe(200);
    const setCookie = res.headers()["set-cookie"] ?? "";
    const cookie = setCookie.split(";")[0];
    expect(cookie).toMatch(/^specter-session=/);
    await anon.dispose();
    const api = await request.newContext({ baseURL, extraHTTPHeaders: { cookie } });
    return { name, email, password, api, cookie };
};

// An API context for whoever is signed in on the page
export const userFromPage = async (page: Page, baseURL: string) => {
    const session = (await page.context().cookies()).find((c) => c.name === "specter-session");
    expect(session).toBeDefined();
    const cookie = `${session!.name}=${session!.value}`;
    return { cookie, api: await request.newContext({ baseURL, extraHTTPHeaders: { cookie } }) };
};

export const createWorkspace = async (api: APIRequestContext, name = "E2E Workspace") => {
    const res = await api.post("/api/workspaces", { multipart: { name } });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data as { $id: string; inviteCode: string; name: string };
};

const isoDay = (offsetDays: number) => {
    const date = new Date(Date.now() + offsetDays * 86_400_000);
    return date.toISOString().slice(0, 10);
};

export const createProject = async (api: APIRequestContext, workspaceId: string, name = "E2E Project", sprintDays = 14) => {
    const res = await api.post("/api/projects", {
        multipart: { name, workspaceId, currentSprintStartDate: isoDay(0), currentSprintEndDate: isoDay(sprintDays - 1) },
    });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data as { $id: string; name: string };
};

export const getMembers = async (api: APIRequestContext, workspaceId: string) => {
    const res = await api.get(`/api/members?workspaceId=${workspaceId}`);
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data.documents as { $id: string; userId: string; role: string; name: string }[];
};

export const createTask = async (
    api: APIRequestContext,
    fields: { workspaceId: string; projectId: string; assigneeId: string; name?: string; [key: string]: unknown },
) => {
    const res = await api.post("/api/tasks", {
        data: { name: "E2E task", status: "TODO", storyPoints: 3, dueDate: new Date().toISOString(), ...fields },
    });
    return res;
};

// Fails the test on uncaught page errors and console errors (React warnings included)
export const watchConsole = (page: Page) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(`console: ${message.text()} ${message.location().url}`);
    });
    page.on("response", (response) => {
        if (response.status() >= 400) errors.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
    });
    return errors;
};
