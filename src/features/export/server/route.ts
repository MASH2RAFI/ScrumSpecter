import "server-only";

import { randomBytes, timingSafeEqual } from "crypto";

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { and, arrayContains, arrayOverlaps, asc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";

import { db } from "@/lib/db";
import { changeRequests, members, projects, routines, tasks, users, workspaceHolidays, workspaces } from "@/lib/db/schema";
import { rateLimited } from "@/lib/rate-limit";
import { localDate } from "@/lib/reminders";
import { sessionMiddleware } from "@/lib/session-middleware";
import { VOLUME_CAPS } from "@/lib/volume-caps";
import { forgetCachedSessions, mergePreferences } from "@/lib/auth";
import { idString, MAX_DESCRIPTION, MAX_TITLE } from "@/lib/limits";
import { requireAdmin, requireMember } from "@/features/members/utils";
import { resolvePreferences } from "@/features/auth/preferences";
import { baseFilters, listQuerySchema, orderFor, routineRule, selectTasks } from "@/features/tasks/server/task-list";
import { DEFAULT_DURATION_MINUTES } from "@/features/tasks/task-time";

import { bulkQuote, CSV_BOM, csvRow, icsDate, icsLine, icsText, icsUtc } from "../format";

// Exports (TODO §14). Every one checks membership like the routes it mirrors; the whole-workspace
// ones (bulk script, backup) are Admin only. No export returns more tasks than a workspace may hold.

const CHUNK = 1000;
const MINUTE = 60_000;


// HH:MM (24-hour) of an instant in a time zone
const localTime = (instant: Date, timeZone: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(instant);

const nextDay = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
};

const attachment = (contentType: string, filename: string) => ({
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
});

// People and placeholders of a workspace, oldest first
const loadMembers = (workspaceId: string) =>
    db.select({
        id: members.id,
        userId: members.userId,
        role: members.role,
        name: sql<string>`coalesce(${users.name}, ${members.placeholderName}, '')`,
        email: users.email,
        placeholderEmail: members.placeholderEmail,
    })
        .from(members)
        .leftJoin(users, eq(users.id, members.userId))
        .where(eq(members.workspaceId, workspaceId))
        .orderBy(asc(members.createdAt));

type TaskRow = Awaited<ReturnType<typeof selectTasks>>[number];

// The matching tasks a chunk at a time, so a large workspace never sits in memory at once
const streamTasks = (where: SQL | undefined, order: SQL[], head: string, toText: (row: TaskRow) => string, tail: string) => {
    const encoder = new TextEncoder();
    let offset = 0;
    return new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(encoder.encode(head));
        },
        async pull(controller) {
            const rows = await selectTasks(where).orderBy(...order).limit(Math.min(CHUNK, VOLUME_CAPS.tasks - offset)).offset(offset);
            offset += rows.length;
            controller.enqueue(encoder.encode(rows.map(toText).join("")));
            if (rows.length < CHUNK || offset >= VOLUME_CAPS.tasks) {
                controller.enqueue(encoder.encode(tail));
                controller.close();
            }
        },
    });
};

const CSV_HEADER = ["Name", "Project", "Status", "Assignees", "Due date", "Time", "Duration (min)", "Points", "Description", "Routine", "Created", "Updated"];

// Bulk-input names: unique (case-insensitively) within `taken`, at most `max` characters
const uniqueName = (raw: string, max: number, taken: Set<string>) => {
    const base = raw.replace(/\s+/g, " ").trim().slice(0, max) || "Unnamed";
    let name = base;
    for (let i = 2; taken.has(name.toLowerCase()); i++) name = `${base.slice(0, max - 6)} (${i})`;
    taken.add(name.toLowerCase());
    return name;
};

const WEEKDAY_NAMES = ["", "mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PLAIN_EMAIL = /^[^\s"\\@]+@[^\s"\\@]+\.[^\s"\\@]+$/;


// Scheduled tasks as an iCalendar stream: a time block is a timed event; a date-only task is all day on its local date
const calendarStream = (filters: SQL | undefined, timeZone: string) => {
    const stamp = icsUtc(new Date());
    const head = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ScrumSpecter//Export//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"].map(icsLine).join("");
    return streamTasks(and(filters, isNotNull(tasks.dueDate)), [asc(tasks.dueDate), asc(tasks.id)], head, ({ task, project }) => {
        const day = localDate(task.dueDate!, timeZone);
        const when = task.startAt
            ? [`DTSTART:${icsUtc(task.startAt)}`, `DTEND:${icsUtc(new Date(task.startAt.getTime() + (task.durationMinutes ?? DEFAULT_DURATION_MINUTES) * MINUTE))}`]
            : [`DTSTART;VALUE=DATE:${icsDate(day)}`, `DTEND;VALUE=DATE:${icsDate(nextDay(day))}`];
        return [
            "BEGIN:VEVENT",
            `UID:${task.id}@scrumspecter`,
            `DTSTAMP:${stamp}`,
            ...when,
            `SUMMARY:${icsText(task.name)}`,
            ...(task.description ? [`DESCRIPTION:${icsText(task.description)}`] : []),
            ...(project ? [`CATEGORIES:${icsText(project.name)}`] : []),
            "END:VEVENT",
        ].map(icsLine).join("");
    }, icsLine("END:VCALENDAR"));
};

const FEED_DAYS_BACK = 30;
const FEED_DAYS_AHEAD = 180;

const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

const app = new Hono()
    // Tasks as CSV or a calendar (.ics), with the same filters and scope as GET /api/tasks
    .get(
        "/tasks",
        sessionMiddleware,
        zValidator("query", listQuerySchema),
        async (c) => {
            const format = c.req.query("format") ?? "csv";
            if (format !== "csv" && format !== "ics") return c.json({ error: "format must be csv or ics" }, 400);
            const q = c.req.valid("query");

            const member = await requireMember(c, q.workspaceId);
            if (member instanceof Response) return member;

            const timeZone = c.get("user").preferences.timeZone;
            const filters = and(...baseFilters(q, member.$id), routineRule(q));

            if (format === "csv") {
                const [people, routineRows] = await Promise.all([
                    loadMembers(q.workspaceId),
                    db.select({ id: routines.id, name: routines.name }).from(routines).where(eq(routines.workspaceId, q.workspaceId)),
                ]);
                const names = new Map(people.map((person) => [person.id, person.name]));
                const routineNames = new Map(routineRows.map((routine) => [routine.id, routine.name]));
                const stream = streamTasks(filters, orderFor(q), CSV_BOM + csvRow(CSV_HEADER), ({ task, project }) => csvRow([
                    task.name,
                    project?.name,
                    task.status,
                    task.assigneeIds.flatMap((id) => names.get(id) ?? []).join(", "),
                    task.dueDate && localDate(task.dueDate, timeZone),
                    task.startAt && localTime(task.startAt, timeZone),
                    task.startAt ? task.durationMinutes ?? DEFAULT_DURATION_MINUTES : null,
                    task.storyPoints,
                    task.description,
                    task.routineId && routineNames.get(task.routineId),
                    task.createdAt.toISOString(),
                    task.updatedAt.toISOString(),
                ]), "");
                return new Response(stream, { headers: attachment("text/csv; charset=utf-8", "tasks.csv") });
            }

            const stream = calendarStream(filters, timeZone);
            return new Response(stream, { headers: attachment("text/calendar; charset=utf-8", "tasks.ics") });
        }
    )

    // The workspace as a bulk-input script, to paste into Bulk setup and rebuild it elsewhere.
    // The exporter is "me"; everyone else becomes a placeholder (no emails of people's accounts).
    .get(
        "/workspaces/:workspaceId/bulk-script",
        sessionMiddleware,
        async (c) => {
            const { workspaceId } = c.req.param();
            const user = c.get("user");
            const member = await requireAdmin(c, workspaceId, "Only admins can export the whole workspace");
            if (member instanceof Response) return member;
            const limited = await rateLimited(c, "export", user.$id);
            if (limited) return limited;

            const timeZone = user.preferences.timeZone;
            const [[workspace], people, projectRows, routineRows, holidayRows, taskRows] = await Promise.all([
                db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, workspaceId)),
                loadMembers(workspaceId),
                db.select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(asc(projects.createdAt)),
                db.select().from(routines).where(eq(routines.workspaceId, workspaceId)).orderBy(asc(routines.createdAt)),
                db.select().from(workspaceHolidays)
                    .where(and(eq(workspaceHolidays.workspaceId, workspaceId), eq(workspaceHolidays.kind, "custom")))
                    .orderBy(asc(workspaceHolidays.date)),
                // Routine tasks are left out: the routines make them again
                db.select().from(tasks)
                    .where(and(eq(tasks.workspaceId, workspaceId), isNull(tasks.routineId)))
                    .orderBy(asc(tasks.createdAt), asc(tasks.id))
                    .limit(VOLUME_CAPS.tasks),
            ]);

            const lines = [
                `# Workspace "${(workspace?.name ?? "").replace(/\s+/g, " ")}", exported ${localDate(new Date(), timeZone)}; times are in ${timeZone}.`,
                "# Paste into Bulk setup to rebuild it. Bulk input checks 500 lines at a time: paste a longer script in parts, in order.",
            ];

            const memberTaken = new Set([user.name.toLowerCase(), user.email.toLowerCase(), "me"]);
            const memberRef = new Map<string, string>();
            for (const person of people) {
                if (person.id === member.$id) {
                    memberRef.set(person.id, "me");
                    continue;
                }
                // Commas separate assignees, so they can't be part of a name
                const name = uniqueName(person.name.replace(/,/g, " "), 60, memberTaken);
                memberRef.set(person.id, name);
                const email = person.userId === null ? person.placeholderEmail?.toLowerCase() : null;
                lines.push(`placeholder add ${bulkQuote(name)}${email && PLAIN_EMAIL.test(email) ? ` email:${email}` : ""}`);
            }
            const assignees = (ids: string[]) => {
                const refs = ids.flatMap((id) => memberRef.get(id) ?? []);
                return `assignee:${bulkQuote(refs.length ? refs.join(", ") : "me")}`;
            };
            const points = (value: number | null) => value !== null && value >= 1 && value <= 100 ? ` points:${value}` : "";
            const duration = (minutes: number | null) => minutes !== null && minutes >= 5 && minutes <= 1440 ? ` duration:${minutes}` : "";

            const projectTaken = new Set<string>();
            const projectRef = new Map<string, string>();
            for (const project of projectRows) {
                const name = uniqueName(project.name, 200, projectTaken);
                projectRef.set(project.id, name);
                const start = project.currentSprintStartDate;
                const end = project.currentSprintEndDate;
                lines.push(`project add ${bulkQuote(name)}${start && end && start <= end ? ` start:${start} end:${end}` : ""}`);
            }

            for (const holiday of holidayRows) {
                lines.push(`holiday add ${holiday.date} ${bulkQuote(holiday.name.slice(0, 80))}`);
            }

            for (const routine of routineRows) {
                if (!routine.active || routine.weekdays.length === 0) {
                    lines.push(`# Routine ${bulkQuote(routine.name)} is paused, so it isn't included`);
                    continue;
                }
                const days = routine.weekdays.length === 7 ? "daily" : routine.weekdays.map((day) => WEEKDAY_NAMES[day]).join(",");
                const shown = [routine.showInTable && "table", routine.showInKanban && "kanban", routine.showInCalendar && "calendar"].filter(Boolean);
                lines.push([
                    `routine add ${bulkQuote(routine.name.slice(0, MAX_TITLE))} ${routine.projectId ? `project:${bulkQuote(projectRef.get(routine.projectId)!)} ` : ""}${assignees(routine.assigneeIds)} days:${days}`,
                    routine.startTime ? ` time:${routine.startTime}${duration(routine.durationMinutes)}` : "",
                    points(routine.storyPoints),
                    shown.length === 3 ? "" : ` show:${shown.length ? shown.join(",") : "none"}`,
                ].join(""));
            }

            for (const task of taskRows) {
                const due = task.dueDate ? localDate(task.dueDate, timeZone) : null;
                lines.push([
                    `task add ${bulkQuote(task.name.slice(0, MAX_TITLE))} ${task.projectId ? `project:${bulkQuote(projectRef.get(task.projectId)!)} ` : ""}${assignees(task.assigneeIds)}`,
                    ` status:${task.status.toLowerCase()}`,
                    due ? ` due:${due}` : "",
                    due && task.startAt ? ` time:${localTime(task.startAt, timeZone)}${duration(task.durationMinutes)}` : "",
                    points(task.storyPoints),
                    task.description?.trim() ? ` description:${bulkQuote(task.description.trim().slice(0, MAX_DESCRIPTION))}` : "",
                ].join(""));
            }

            return c.body(`${lines.join("\n")}\n`, 200, attachment("text/plain; charset=utf-8", "workspace-bulk-input.txt"));
        }
    )

    // Everything in the workspace as versioned JSON, for Admins. Members' emails only when asked.
    .get(
        "/workspaces/:workspaceId/backup",
        sessionMiddleware,
        zValidator("query", z.object({ emails: z.enum(["true", "false"]).optional() })),
        async (c) => {
            const { workspaceId } = c.req.param();
            const withEmails = c.req.valid("query").emails === "true";
            const user = c.get("user");
            const member = await requireAdmin(c, workspaceId, "Only admins can back up the workspace");
            if (member instanceof Response) return member;
            const limited = await rateLimited(c, "export", user.$id);
            if (limited) return limited;

            const [[workspace], people, projectRows, taskRows, routineRows, holidayRows, requestRows] = await Promise.all([
                // Not the invite codes: they let people in
                db.select({
                    name: workspaces.name,
                    workDayStart: workspaces.workDayStart,
                    workDayEnd: workspaces.workDayEnd,
                    holidayCountry: workspaces.holidayCountry,
                    createdAt: workspaces.createdAt,
                }).from(workspaces).where(eq(workspaces.id, workspaceId)),
                loadMembers(workspaceId),
                db.select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(asc(projects.createdAt)),
                db.select().from(tasks).where(eq(tasks.workspaceId, workspaceId)).orderBy(asc(tasks.createdAt), asc(tasks.id)).limit(VOLUME_CAPS.tasks),
                db.select().from(routines).where(eq(routines.workspaceId, workspaceId)).orderBy(asc(routines.createdAt)),
                db.select().from(workspaceHolidays).where(eq(workspaceHolidays.workspaceId, workspaceId)).orderBy(asc(workspaceHolidays.date)),
                db.select().from(changeRequests).where(eq(changeRequests.workspaceId, workspaceId)).orderBy(asc(changeRequests.createdAt)),
            ]);

            const backup = {
                version: 1,
                exportedAt: new Date().toISOString(),
                workspace: { id: workspaceId, ...workspace },
                members: people.map((person) => ({
                    id: person.id,
                    name: person.name,
                    role: person.role,
                    placeholder: person.userId === null,
                    ...(withEmails ? { email: person.email ?? person.placeholderEmail } : {}),
                })),
                projects: projectRows,
                tasks: taskRows,
                routines: routineRows,
                holidays: holidayRows,
                changeRequests: requestRows,
            };
            return c.body(JSON.stringify(backup, null, 2), 200, attachment("application/json; charset=utf-8", "workspace-backup.json"));
        }
    )

    // The signed-in person's own data across workspaces: account, memberships, tasks assigned
    // to them and the change requests they sent
    .get(
        "/me",
        sessionMiddleware,
        async (c) => {
            const user = c.get("user");
            const limited = await rateLimited(c, "export", user.$id);
            if (limited) return limited;

            const [[account], memberships] = await Promise.all([
                db.select({ name: users.name, email: users.email, preferences: sql<Record<string, unknown>>`${users.preferences} - 'calendarFeedKey'`, createdAt: users.createdAt })
                    .from(users).where(eq(users.id, user.$id)),
                db.select({ id: members.id, role: members.role, workspaceId: workspaces.id, workspace: workspaces.name, ownerId: workspaces.userId })
                    .from(members).innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
                    .where(eq(members.userId, user.$id)),
            ]);
            const memberIds = memberships.map((membership) => membership.id);
            const [assigned, requests] = memberIds.length === 0 ? [[], []] : await Promise.all([
                db.select({ task: tasks, project: projects.name })
                    .from(tasks).leftJoin(projects, eq(projects.id, tasks.projectId))
                    .where(arrayOverlaps(tasks.assigneeIds, memberIds))
                    .orderBy(asc(tasks.createdAt))
                    .limit(VOLUME_CAPS.tasks),
                db.select().from(changeRequests).where(inArray(changeRequests.requesterId, memberIds)).orderBy(asc(changeRequests.createdAt)),
            ]);

            const data = {
                version: 1,
                exportedAt: new Date().toISOString(),
                account,
                workspaces: memberships.map(({ workspaceId, workspace, role, ownerId }) => ({ id: workspaceId, name: workspace, role, owner: ownerId === user.$id })),
                assignedTasks: assigned.map(({ task, project }) => ({ ...task, project })),
                changeRequests: requests,
            };
            return c.body(JSON.stringify(data, null, 2), 200, attachment("application/json; charset=utf-8", "my-scrumspecter-data.json"));
        }
    )

    // A private calendar-subscribe link to "my tasks" in a workspace, for Google/Apple Calendar.
    // reset: a new key, so every earlier link stops working
    .post(
        "/calendar-feed",
        sessionMiddleware,
        zValidator("json", z.object({ workspaceId: idString, reset: z.boolean().optional() })),
        async (c) => {
            const { workspaceId, reset } = c.req.valid("json");
            const member = await requireMember(c, workspaceId);
            if (member instanceof Response) return member;

            const user = c.get("user");
            let key = user.preferences.calendarFeedKey;
            if (!key || reset) {
                key = randomBytes(24).toString("base64url");
                await mergePreferences(user.$id, { calendarFeedKey: key });
                // Cached sessions still hold the old preferences for up to 30 s
                forgetCachedSessions(user.$id);
            }
            const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(c.req.url).origin;
            return c.json({ data: { url: `${origin}/api/export/feed/${user.$id}/${workspaceId}/${key}.ics` } });
        }
    )

    // The feed itself: no session (calendar apps can't sign in), so the key in the link is the check.
    // Every failure is the same 404, so a guess learns nothing.
    .get("/feed/:userId/:workspaceId/:file", async (c) => {
        const { userId, workspaceId, file } = c.req.param();
        const key = file.replace(/\.ics$/, "");
        const notFound = () => c.json({ error: "Not found" }, 404);
        if (userId.length > 64 || workspaceId.length > 64 || key.length > 64) return notFound();

        const [row] = await db.select({ preferences: users.preferences, memberId: members.id })
            .from(users)
            .innerJoin(members, and(eq(members.userId, users.id), eq(members.workspaceId, workspaceId)))
            .where(eq(users.id, userId)).limit(1);
        if (!row) return notFound();
        const { calendarFeedKey, timeZone } = resolvePreferences(row.preferences);
        if (!calendarFeedKey || !sameSecret(calendarFeedKey, key)) return notFound();

        const now = Date.now();
        const stream = calendarStream(and(
            eq(tasks.workspaceId, workspaceId),
            arrayContains(tasks.assigneeIds, [row.memberId]),
            gte(tasks.dueDate, new Date(now - FEED_DAYS_BACK * 86_400_000)),
            lt(tasks.dueDate, new Date(now + FEED_DAYS_AHEAD * 86_400_000)),
        ), timeZone);
        return new Response(stream, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" } });
    });

export default app;
