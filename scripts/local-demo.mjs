#!/usr/bin/env node
// Fills a local demo deployment with dummy data through the app's own API (never the real server).
// Usage: node scripts/local-demo.mjs [base URL, default http://localhost:3200]
// Running it again only signs in; it seeds once per database (.local-demo/pgdata).
//
// Demo accounts (dummy, local only):
const PASSWORD = "demo-password-123";
const USERS = [
    { name: "Dana Admin", email: "dana@demo.test" },
    { name: "Sam Supervisor", email: "sam@demo.test", role: "SUPERVISOR" },
    { name: "Ria Reviewer", email: "ria@demo.test", role: "REVIEWER" },
    { name: "Ali Assignee", email: "ali@demo.test" },
];

const BASE = process.argv[2] || "http://localhost:3200";

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const SCRIPT = [
    `project add "Website v3" start:${day(-3)} end:${day(10)}`,
    `project add "Mobile app" start:${day(0)} end:${day(13)}`,
    `task add "Hero section" project:"Website v3" assignee:"Dana Admin" status:in_progress due:${day(1)} time:10:00 duration:90 points:5 description:"New headline, illustration and call to action."`,
    `task add "Pricing page copy" project:"Website v3" status:in_review due:today points:3`,
    `task add "Fix footer links" project:"Website v3" status:done due:${day(-1)} points:1`,
    `task add "SEO audit" project:"Website v3" status:todo due:${day(3)} points:8`,
    `task add "Cookie banner" project:"Website v3" status:backlog points:2`,
    `task add "Release notes" project:"Website v3" due:tomorrow`,
    `task add "Login screen" project:"Mobile app" status:todo due:${day(2)} time:14:00 duration:2h points:5`,
    `task add "Push notifications" project:"Mobile app" status:backlog points:8`,
    `task add "App icon" project:"Mobile app" status:done due:${day(-2)} points:2`,
    `routine add "Standup" project:"Website v3" days:sun,mon,tue,wed,thu time:09:30 duration:15`,
    `routine add "Weekly review" project:"Mobile app" days:thu time:16:00 duration:1h points:1`,
    `holiday add ${day(20)} "Team offsite"`,
].join("\n");

const call = async (path, { cookie, ...init } = {}) => {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...init.headers },
    });
    const body = await res.json().catch(() => ({}));
    return { res, body };
};

const signIn = async ({ name, email }) => {
    let { res } = await call("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password: PASSWORD }) });
    if (res.status === 409) ({ res } = await call("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password: PASSWORD }) }));
    if (!res.ok) throw new Error(`${email}: ${res.status} ${await res.text()}`);
    // The session cookie is Secure; send it back by hand
    return res.headers.get("set-cookie").split(";")[0];
};

for (let i = 0; ; i++) {
    try {
        if ((await fetch(`${BASE}/sign-in`)).ok) break;
    } catch { /* not up yet */ }
    if (i > 120) throw new Error(`${BASE} didn't come up`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

const cookies = [];
for (const user of USERS) cookies.push(await signIn(user));
const [admin] = cookies;

const existing = (await call("/api/workspaces", { cookie: admin })).body.data?.documents ?? [];
if (existing.some((w) => w.name === "Demo Studio")) {
    console.log(`Already seeded. Open ${BASE} and sign in with an account from scripts/local-demo.mjs.`);
    process.exit(0);
}

await call("/api/account/preferences", { method: "PATCH", cookie: admin, body: JSON.stringify({ showTutorial: false }) });
const setup = await call("/api/workspaces/setup", { method: "POST", cookie: admin, body: JSON.stringify({ name: "Demo Studio", script: SCRIPT, apply: true }) });
if (!setup.res.ok || !setup.body.data) throw new Error(`setup: ${JSON.stringify(setup.body)}`);
const workspace = (await call("/api/workspaces", { cookie: admin })).body.data.documents.find((w) => w.name === "Demo Studio");

for (let i = 1; i < USERS.length; i++) {
    const join = await call(`/api/workspaces/${workspace.$id}/join`, { method: "POST", cookie: cookies[i], body: JSON.stringify({ code: workspace.inviteCode }) });
    if (!join.res.ok) throw new Error(`join ${USERS[i].email}: ${JSON.stringify(join.body)}`);
}

const members = (await call(`/api/members?workspaceId=${workspace.$id}`, { cookie: admin })).body.data.documents;
for (const user of USERS.filter((u) => u.role)) {
    const member = members.find((m) => m.name === user.name);
    await call(`/api/members/${member.$id}`, { method: "PATCH", cookie: admin, body: JSON.stringify({ role: user.role }) });
}

// A few tasks for the teammates, so My Tasks and the team chart aren't empty
const projects = (await call(`/api/projects?workspaceId=${workspace.$id}`, { cookie: admin })).body.data.documents;
const website = projects.find((p) => p.name === "Website v3");
const byName = Object.fromEntries(members.map((m) => [m.name, m.$id]));
for (const [name, who, status, offset] of [
    ["Accessibility check", "Ria Reviewer", "TODO", 2],
    ["Image compression", "Ali Assignee", "IN_PROGRESS", 1],
    ["Sprint planning notes", "Sam Supervisor", "DONE", -1],
]) {
    await call("/api/tasks", {
        method: "POST", cookie: admin,
        body: JSON.stringify({ name, workspaceId: workspace.$id, projectId: website.$id, assigneeIds: [byName[who]], status, storyPoints: 3, dueDate: new Date(Date.now() + offset * 86_400_000).toISOString() }),
    });
}

console.log(`Seeded "Demo Studio". Open ${BASE} and sign in with an account from scripts/local-demo.mjs.`);
