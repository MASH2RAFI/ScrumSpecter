import "server-only";

import { randomUUID } from "crypto";

import { MAX_DESCRIPTION, MAX_TITLE } from "@/lib/limits";
import { zonedTimeToUtc } from "@/lib/time-zone";
import { TaskStatus } from "@/features/tasks/types";
import { MemberRole } from "@/features/members/types";
import { canEditWork, canManageWorkspace, canReview } from "@/features/members/permissions";

// Bulk input (Settings → Bulk input): one command per line. Parsing and planning are pure, so a
// script is fully checked (and any line's problem reported) before anything is written.
//
//   project add "Website v3" start:2026-11-01 end:2026-11-14
//   task add "Hero section" project:"Website v3" assignee:"Sara Rahman, Tom" due:2026-11-03 time:10:00 duration:90 points:3
//   routine add "Standup" project:"Website v3" assignee:me days:sat,sun,mon time:09:30 duration:15 show:table,calendar
//   holiday add 2026-12-31 "Year-end closure"
//   placeholder add "Designer (TBD)" email:designer@example.com
//   task update "Hero section" project:"Website v3" status:done
//   task remove id:<task id>
//
// Blank lines and lines starting with # are ignored.

export const MAX_LINES = 500;
export const MAX_SCRIPT_LENGTH = 50_000;

// An existing task or routine an update/remove line can point at
export type TaskRef = { id: string; name: string; projectId: string | null; due: string | null };
export type RoutineRef = { id: string; name: string };

export type Context = {
    // Lower-cased name -> id
    projects: Map<string, string>;
    // Lower-cased name or email -> member id (people and placeholders)
    members: Map<string, string>;
    // Member ids that are placeholders
    placeholders: Set<string>;
    // Only the tasks the script's update/remove lines name (see taskReferences)
    tasks: TaskRef[];
    routines: RoutineRef[];
    // Custom days off, YYYY-MM-DD -> name
    holidays: Map<string, string>;
    // Project id -> how many tasks it has (what removing it deletes)
    projectTaskCounts: Map<string | null, number>;
    me: string;
    // Admins and Supervisors write everything their role allows; Reviewers and Assignees only add
    // tasks (their own saved, anyone else's sent for approval)
    role: MemberRole;
    timeZone: string;
    // YYYY-MM-DD in timeZone
    today: string;
};

type TaskFields = {
    name: string; projectId: string | null; assigneeIds: string[]; status: TaskStatus;
    dueDate: Date | null; startAt: Date | null; durationMinutes: number | null; storyPoints: number; description: string | null;
};
type RoutineFields = {
    name: string; projectId: string | null; assigneeIds: string[]; weekdays: number[];
    startTime: string | null; durationMinutes: number | null; storyPoints: number; timeZone: string; description: string | null;
    showInTable: boolean; showInKanban: boolean; showInCalendar: boolean; active: boolean;
};
type ProjectFields = { name: string; currentSprintStartDate: string | null; currentSprintEndDate: string | null; sprintDuration: number | null };

export type Planned =
    | { kind: "project"; id: string; name: string; start: string | null; end: string | null }
    | { kind: "placeholder"; id: string; name: string; email: string | null }
    // requested: sent as a change request instead of saved (Reviewers and Assignees)
    | ({ kind: "task"; id: string; requested: boolean } & TaskFields)
    | ({ kind: "routine"; id: string } & Omit<RoutineFields, "active">)
    | { kind: "holiday"; date: string; name: string }
    | { kind: "taskUpdate"; id: string; set: Partial<TaskFields> }
    | { kind: "routineUpdate"; id: string; set: Partial<RoutineFields>; retime: boolean }
    | { kind: "projectUpdate"; id: string; set: Partial<ProjectFields> }
    | { kind: "taskRemove"; id: string }
    | { kind: "routineRemove"; id: string }
    | { kind: "projectRemove"; id: string }
    | { kind: "holidayRemove"; date: string }
    // fallbackId takes over tasks nobody else would be left on
    | { kind: "placeholderRemove"; id: string; fallbackId: string };

export const MAX_REMOVALS = 50;

export type LineResult = {
    line: number; text: string; ok: boolean; summary?: string; error?: string;
    // Reviewers and Assignees: saved directly, or sent for approval
    outcome?: "saved" | "request";
    // The line deletes something (the UI asks before applying)
    removes?: boolean;
    // A routine's views, for the toggles in the preview
    show?: { table: boolean; kanban: boolean; calendar: boolean };
};

// Words and "quoted phrases"; key:value and key:"quoted value" stay one token. A token that
// starts with a quote is always a value (so a name like "Fix: login" is never read as an option).
export type Token = { value: string; quoted: boolean };

export const tokenize = (line: string): Token[] | string => {
    const tokens: Token[] = [];
    let current = "";
    let inQuotes = false;
    let started = false;
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === "\\" && inQuotes && (line[i + 1] === "\"" || line[i + 1] === "\\")) {
            current += line[++i];
        } else if (char === "\"") {
            if (!started) quoted = true;
            inQuotes = !inQuotes;
            started = true;
        } else if (/\s/.test(char) && !inQuotes) {
            if (started) tokens.push({ value: current, quoted });
            current = "";
            started = false;
            quoted = false;
        } else {
            current += char;
            started = true;
        }
    }
    if (inQuotes) return "A quote isn't closed";
    if (started) tokens.push({ value: current, quoted });
    return tokens;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const DAY_NAMES: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
const STATUSES: Record<string, TaskStatus> = {
    backlog: TaskStatus.BACKLOG,
    todo: TaskStatus.TODO,
    in_progress: TaskStatus.IN_PROGRESS,
    "in-progress": TaskStatus.IN_PROGRESS,
    in_review: TaskStatus.IN_REVIEW,
    "in-review": TaskStatus.IN_REVIEW,
    done: TaskStatus.DONE,
};

const validDate = (value: string) => {
    if (!DATE.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const addDays = (date: string, days: number) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

// "90", "90m", "1.5h", "2h" -> minutes
const parseDuration = (value: string) => {
    const match = value.match(/^(\d+(?:\.\d+)?)(m|h)?$/);
    if (!match) return null;
    const minutes = Math.round(Number(match[1]) * (match[2] === "h" ? 60 : 1));
    return minutes >= 5 && minutes <= 1440 ? minutes : null;
};

class LineError extends Error {}

const fail = (message: string): never => {
    throw new LineError(message);
};

type Args = { positional: string[]; options: Map<string, string> };

const KEY_VALUE = /^([a-z]+):(.*)$/i;

// show:table,kanban,calendar (any of them), or show:none for Home and My work only
const ROUTINE_VIEW_NAMES = ["table", "kanban", "calendar"] as const;
const parseShow = (value: string | undefined) => {
    if (value === undefined) return { showInTable: true, showInKanban: true, showInCalendar: true };
    const views = value.toLowerCase().split(",").map((part) => part.trim()).filter(Boolean);
    const shown = new Set<string>();
    if (!(views.length === 1 && views[0] === "none")) {
        for (const view of views) {
            if (!(ROUTINE_VIEW_NAMES as readonly string[]).includes(view)) fail(`"${view}" isn't a view; use show:table,kanban,calendar or show:none`);
            shown.add(view);
        }
    }
    return { showInTable: shown.has("table"), showInKanban: shown.has("kanban"), showInCalendar: shown.has("calendar") };
};

const splitArgs = (tokens: Token[], allowed: string[]): Args => {
    const positional: string[] = [];
    const options = new Map<string, string>();
    for (const token of tokens) {
        const match = token.quoted ? null : token.value.match(KEY_VALUE);
        if (match && allowed.includes(match[1].toLowerCase())) {
            const key = match[1].toLowerCase();
            if (options.has(key)) fail(`${key}: is given twice`);
            options.set(key, match[2]);
        } else if (match) {
            fail(`Unknown option "${match[1]}:"${allowed.length ? ` (allowed: ${allowed.map((key) => `${key}:`).join(" ")})` : ""}. Put names in "quotes".`);
        } else {
            positional.push(token.value);
        }
    }
    return { positional, options };
};

const requireName = (positional: string[], what: string) => {
    if (positional.length === 0) fail(`Give the ${what} a name, e.g. ${what} add "My ${what}"`);
    if (positional.length > 1) fail(`Put the ${what} name in "quotes" (found ${positional.length} words)`);
    const name = positional[0].trim();
    if (!name) fail(`The ${what} name is empty`);
    if (name.length > 200) fail(`The ${what} name is too long (max 200 characters)`);
    return name;
};

// The task names and ids that update/remove lines refer to, so only those tasks are loaded
export const taskReferences = (script: string) => {
    const names = new Set<string>();
    const ids = new Set<string>();
    for (const raw of script.split(/\r?\n/).slice(0, MAX_LINES)) {
        const tokens = tokenize(raw.trim());
        if (typeof tokens === "string" || tokens.length < 3) continue;
        if (tokens[0].value.toLowerCase() !== "task" || !["update", "remove"].includes(tokens[1].value.toLowerCase())) continue;
        for (const token of tokens.slice(2)) {
            const match = token.quoted ? null : token.value.match(KEY_VALUE);
            if (!match) names.add(token.value.trim().toLowerCase());
            else if (match[1].toLowerCase() === "id") ids.add(match[2]);
        }
    }
    return { names: Array.from(names), ids: Array.from(ids) };
};

// Plans every line against the workspace; names created earlier in the script can be used later
export const planScript = (script: string, context: Context) => {
    const lines = script.split(/\r?\n/);
    const results: LineResult[] = [];
    const plan: Planned[] = [];
    const projects = new Map(context.projects);
    const members = new Map(context.members);
    const placeholders = new Set(context.placeholders);
    // Copies: renames and new due dates are tracked as the script goes
    const taskIndex = context.tasks.map((task) => ({ ...task }));
    const routineIndex = [...context.routines];
    const holidays = new Map(context.holidays);
    const projectTaskCounts = new Map(context.projectTaskCounts);
    const canEdit = canEditWork(context.role);
    const canManage = canManageWorkspace(context.role);
    let removals = 0;

    const resolveDate = (value: string) => {
        const lower = value.toLowerCase();
        if (lower === "today") return context.today;
        if (lower === "tomorrow") return addDays(context.today, 1);
        if (!validDate(value)) fail(`"${value}" isn't a date; use YYYY-MM-DD, today or tomorrow`);
        return value;
    };
    const resolveProject = (value: string | undefined) => {
        if (!value) fail("project: is required");
        const id = projects.get(value!.toLowerCase());
        if (!id) fail(`No project called "${value}"`);
        return id!;
    };
    // One or more comma-separated names or emails; "me" is whoever runs the script
    const resolveAssignees = (value: string | undefined) => {
        const names = (value ?? "me").split(",").map((name) => name.trim()).filter(Boolean);
        if (names.length === 0) fail("assignee: is empty");
        if (names.length > 20) fail("At most 20 assignees");
        const ids = names.map((name) => {
            if (name.toLowerCase() === "me") return context.me;
            const id = members.get(name.toLowerCase());
            if (!id) fail(`No member or placeholder called "${name}"`);
            if (id === AMBIGUOUS) fail(`More than one member is called "${name}"; use their email instead`);
            return id!;
        });
        return Array.from(new Set(ids));
    };
    const requireAdmin = (what: string) => {
        if (!canManage) fail(`Only admins can ${what}`);
    };
    const resolvePoints = (value: string | undefined) => {
        if (value === undefined) return 1;
        const points = Number(value);
        if (!Number.isInteger(points) || points < 1 || points > 100) fail("points: must be a whole number from 1 to 100");
        return points;
    };
    const resolveTime = (time: string | undefined, duration: string | undefined) => {
        if (time === undefined) {
            if (duration !== undefined) fail("duration: needs a time: too");
            return { time: null, minutes: null };
        }
        if (!TIME.test(time)) fail(`"${time}" isn't a time; use 24-hour HH:MM, e.g. 09:30`);
        const minutes = duration === undefined ? 30 : parseDuration(duration);
        if (minutes === null) fail(`"${duration}" isn't a duration; use minutes (90) or hours (1.5h), from 5 minutes to 24 hours`);
        return { time, minutes };
    };
    const resolveStatus = (value: string) => {
        const status = STATUSES[value.toLowerCase()];
        if (!status) fail(`status: must be one of ${Object.keys(STATUSES).filter((key) => !key.includes("-")).join(", ")}`);
        return status;
    };
    const resolveDescription = (value: string | undefined) => {
        if (value && value.length > MAX_DESCRIPTION) fail(`description: is too long (max ${MAX_DESCRIPTION} characters)`);
        return value || null;
    };
    const resolveWeekdays = (value: string | undefined) => {
        const daysText = value?.toLowerCase();
        if (!daysText) fail("days: is required, e.g. days:sat,sun,mon or days:daily");
        const weekdays = daysText === "daily"
            ? [1, 2, 3, 4, 5, 6, 7]
            : daysText!.split(",").map((part) => {
                const day = DAY_NAMES[part.trim().slice(0, 3)];
                if (!day) fail(`"${part}" isn't a weekday; use sat, sun, mon, tue, wed, thu, fri`);
                return day;
            });
        return Array.from(new Set(weekdays)).sort();
    };
    // Same convention as the task form: the day's start in the author's time zone
    const instants = (due: string, time: string | null) => {
        const [year, month, day] = due.split("-").map(Number);
        return {
            dueDate: zonedTimeToUtc(year, month, day, "00:00", context.timeZone),
            startAt: time ? zonedTimeToUtc(year, month, day, time, context.timeZone) : null,
        };
    };
    // Exactly one match, by id: or by name (within project: when given)
    const findTask = (positional: string[], options: Map<string, string>) => {
        const id = options.get("id");
        if (id) return taskIndex.find((task) => task.id === id) ?? fail(`No task with id:${id}`);
        const name = requireName(positional, "task");
        const projectId = options.has("project") ? resolveProject(options.get("project")) : null;
        const matches = taskIndex.filter((task) => task.name.toLowerCase() === name.toLowerCase() && (!projectId || task.projectId === projectId));
        if (matches.length === 0) fail(`No task called "${name}"${projectId ? ` in project "${options.get("project")}"` : ""}`);
        if (matches.length > 1) fail(`${matches.length} tasks are called "${name}"; add project: or use id:`);
        return matches[0];
    };
    const findRoutine = (positional: string[], options: Map<string, string>) => {
        const id = options.get("id");
        if (id) return routineIndex.find((routine) => routine.id === id) ?? fail(`No routine with id:${id}`);
        const name = requireName(positional, "routine");
        const matches = routineIndex.filter((routine) => routine.name.toLowerCase() === name.toLowerCase());
        if (matches.length === 0) fail(`No routine called "${name}"`);
        if (matches.length > 1) fail(`${matches.length} routines are called "${name}"; use id:`);
        return matches[0];
    };
    const countRemoval = () => {
        if (++removals > MAX_REMOVALS) fail(`At most ${MAX_REMOVALS} removals per script`);
    };
    const parseSprint = (options: Map<string, string>) => {
        const start = options.has("start") ? resolveDate(options.get("start")!) : null;
        const end = options.has("end") ? resolveDate(options.get("end")!) : null;
        if ((start === null) !== (end === null)) fail("Give both start: and end:, or neither");
        if (start && end && end < start) fail("end: is before start:");
        return { start, end };
    };
    const rename = (value: string) => {
        const name = value.trim();
        if (!name || name.length > MAX_TITLE) fail(`name: needs 1 to ${MAX_TITLE} characters`);
        return name;
    };

    if (lines.length > MAX_LINES) {
        return { results: [{ line: 1, text: "", ok: false, error: `Too many lines (max ${MAX_LINES})` }], plan: [] };
    }

    lines.forEach((raw, index) => {
        const text = raw.trim();
        if (!text || text.startsWith("#")) return;
        const line = index + 1;
        try {
            const tokens = tokenize(text);
            if (typeof tokens === "string") fail(tokens);
            const [entityToken, actionToken, ...rest] = tokens as Token[];
            const entity = entityToken.value.toLowerCase();
            const action = actionToken?.value.toLowerCase();
            if (!["add", "update", "remove"].includes(action)) fail(`Start with "<project|task|routine|holiday|placeholder> <add|update|remove>"`);
            if (!["project", "task", "routine", "holiday", "placeholder"].includes(entity)) {
                fail(`Unknown "${entity}"; use project, task, routine, holiday or placeholder`);
            }
            // Reviewers and Assignees can do only what a single change request could: add tasks
            if (!canEdit && !(entity === "task" && action === "add")) {
                fail(`Only admins and supervisors can ${action} ${entity}s. You can add tasks: yours are saved, anyone else's are sent for approval.`);
            }

            switch (`${entity} ${action}`) {
                case "project add": {
                    const { positional, options } = splitArgs(rest, ["start", "end"]);
                    const name = requireName(positional, "project");
                    if (projects.has(name.toLowerCase())) fail(`There's already a project called "${name}"`);
                    const { start, end } = parseSprint(options);
                    const id = randomUUID();
                    projects.set(name.toLowerCase(), id);
                    plan.push({ kind: "project", id, name, start, end });
                    results.push({ line, text, ok: true, summary: `New project "${name}"${start ? ` (sprint ${start} to ${end})` : ""}` });
                    break;
                }
                case "project update": {
                    const { positional, options } = splitArgs(rest, ["name", "start", "end"]);
                    const name = requireName(positional, "project");
                    const id = resolveProject(name);
                    const set: Partial<ProjectFields> = {};
                    if (options.has("name")) {
                        set.name = rename(options.get("name")!);
                        const taken = projects.get(set.name.toLowerCase());
                        if (taken && taken !== id) fail(`There's already a project called "${set.name}"`);
                        projects.delete(name.toLowerCase());
                        projects.set(set.name.toLowerCase(), id);
                    }
                    const { start, end } = parseSprint(options);
                    if (start && end) {
                        // As in the project form: only admins move a sprint's start
                        requireAdmin("change a project's sprint dates");
                        Object.assign(set, { currentSprintStartDate: start, currentSprintEndDate: end, sprintDuration: sprintDays(start, end) });
                    }
                    if (Object.keys(set).length === 0) fail("Nothing to change; use name: or start: and end:");
                    plan.push({ kind: "projectUpdate", id, set });
                    results.push({ line, text, ok: true, summary: `Update project "${name}"${set.name ? ` → "${set.name}"` : ""}${start ? ` (sprint ${start} to ${end})` : ""}` });
                    break;
                }
                case "project remove": {
                    requireAdmin("delete projects");
                    const { positional } = splitArgs(rest, []);
                    const name = requireName(positional, "project");
                    const id = resolveProject(name);
                    countRemoval();
                    projects.delete(name.toLowerCase());
                    for (let i = taskIndex.length - 1; i >= 0; i--) if (taskIndex[i].projectId === id) taskIndex.splice(i, 1);
                    const count = projectTaskCounts.get(id) ?? 0;
                    plan.push({ kind: "projectRemove", id });
                    results.push({ line, text, ok: true, removes: true, summary: `Delete project "${name}" and its ${count} task${count === 1 ? "" : "s"}` });
                    break;
                }
                case "placeholder add": {
                    requireAdmin("add placeholders");
                    const { positional, options } = splitArgs(rest, ["email"]);
                    const name = requireName(positional, "placeholder");
                    if (name.length > 60) fail("The placeholder name is too long (max 60 characters)");
                    if (members.has(name.toLowerCase())) fail(`"${name}" is already a member or placeholder`);
                    const email = options.get("email")?.toLowerCase() || null;
                    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${email}" isn't an email address`);
                    const id = randomUUID();
                    members.set(name.toLowerCase(), id);
                    if (email) members.set(email, id);
                    placeholders.add(id);
                    plan.push({ kind: "placeholder", id, name, email });
                    results.push({ line, text, ok: true, summary: `New placeholder "${name}"${email ? ` for ${email}` : ""}` });
                    break;
                }
                case "placeholder remove": {
                    requireAdmin("remove placeholders");
                    const { positional } = splitArgs(rest, []);
                    const name = requireName(positional, "placeholder");
                    const id = members.get(name.toLowerCase());
                    if (!id || !placeholders.has(id)) fail(`No placeholder called "${name}"`);
                    countRemoval();
                    for (const [key, value] of Array.from(members)) if (value === id) members.delete(key);
                    placeholders.delete(id!);
                    plan.push({ kind: "placeholderRemove", id: id!, fallbackId: context.me });
                    results.push({ line, text, ok: true, removes: true, summary: `Remove placeholder "${name}" (you take over tasks nobody else is on)` });
                    break;
                }
                case "task add": {
                    const { positional, options } = splitArgs(rest, ["project", "assignee", "status", "due", "time", "duration", "points", "description"]);
                    const name = requireName(positional, "task");
                    // No project: a personal task
                    const projectId = options.has("project") ? resolveProject(options.get("project")) : null;
                    const assigneeIds = resolveAssignees(options.get("assignee"));
                    const status = options.has("status") ? resolveStatus(options.get("status")!) : TaskStatus.TODO;
                    const due = options.has("due") ? resolveDate(options.get("due")!) : null;
                    const { time, minutes } = resolveTime(options.get("time"), options.get("duration"));
                    if (time && !due) fail("time: needs a due: date");
                    // Your own task is saved as if you'd made it; anything else needs approval
                    // (and only reviewers may start a task at Done)
                    const own = assigneeIds.length === 1 && assigneeIds[0] === context.me;
                    const requested = !canEdit && !(own && (canReview(context.role) || status !== TaskStatus.DONE));
                    const id = randomUUID();
                    plan.push({
                        kind: "task",
                        id,
                        requested,
                        name,
                        projectId,
                        assigneeIds,
                        status,
                        ...(due ? instants(due, time) : { dueDate: null, startAt: null }),
                        durationMinutes: minutes,
                        storyPoints: resolvePoints(options.get("points")),
                        description: resolveDescription(options.get("description")),
                    });
                    if (!requested) {
                        taskIndex.push({ id, name, projectId, due });
                        projectTaskCounts.set(projectId, (projectTaskCounts.get(projectId) ?? 0) + 1);
                    }
                    results.push({
                        line, text, ok: true,
                        summary: `New task "${name}"${due ? ` due ${due}${time ? ` at ${time}` : ""}` : ""}`,
                        ...(canEdit ? {} : { outcome: requested ? "request" : "saved" }),
                    });
                    break;
                }
                case "task update": {
                    const { positional, options } = splitArgs(rest, ["id", "project", "status", "due", "time", "duration", "points", "assignee", "name", "description"]);
                    const task = findTask(positional, options);
                    const set: Partial<TaskFields> = {};
                    if (options.has("name")) set.name = rename(options.get("name")!);
                    if (options.has("status")) set.status = resolveStatus(options.get("status")!);
                    if (options.has("assignee")) set.assigneeIds = resolveAssignees(options.get("assignee"));
                    if (options.has("points")) set.storyPoints = resolvePoints(options.get("points"));
                    if (options.has("description")) set.description = resolveDescription(options.get("description"));
                    const dueText = options.get("due");
                    const { time, minutes } = resolveTime(options.get("time"), options.get("duration"));
                    if (dueText?.toLowerCase() === "none") {
                        if (time) fail("time: needs a due: date");
                        Object.assign(set, { dueDate: null, startAt: null, durationMinutes: null });
                        task.due = null;
                    } else if (dueText !== undefined || time) {
                        // due: alone makes it all day; time: alone keeps its day
                        const due = dueText !== undefined ? resolveDate(dueText) : task.due;
                        if (!due) fail("time: needs a due: date");
                        Object.assign(set, instants(due!, time), { durationMinutes: minutes });
                        task.due = due;
                    }
                    if (Object.keys(set).length === 0) fail("Nothing to change; give at least one option, e.g. status:done");
                    const before = task.name;
                    if (set.name) task.name = set.name;
                    plan.push({ kind: "taskUpdate", id: task.id, set });
                    const changed = Object.keys(set).filter((key) => key !== "startAt" && key !== "durationMinutes");
                    results.push({ line, text, ok: true, summary: `Update task "${before}": ${changed.join(", ")}` });
                    break;
                }
                case "task remove": {
                    const { positional, options } = splitArgs(rest, ["id", "project"]);
                    const task = findTask(positional, options);
                    countRemoval();
                    taskIndex.splice(taskIndex.indexOf(task), 1);
                    projectTaskCounts.set(task.projectId, Math.max(0, (projectTaskCounts.get(task.projectId) ?? 0) - 1));
                    plan.push({ kind: "taskRemove", id: task.id });
                    results.push({ line, text, ok: true, removes: true, summary: `Delete task "${task.name}"${task.due ? ` (due ${task.due})` : ""}` });
                    break;
                }
                case "routine add": {
                    const { positional, options } = splitArgs(rest, ["project", "assignee", "days", "time", "duration", "points", "show", "description"]);
                    const name = requireName(positional, "routine");
                    // No project: a personal routine, kept 14 days ahead
                    const projectId = options.has("project") ? resolveProject(options.get("project")) : null;
                    const assigneeIds = resolveAssignees(options.get("assignee"));
                    const weekdays = resolveWeekdays(options.get("days"));
                    const { time, minutes } = resolveTime(options.get("time"), options.get("duration"));
                    const show = parseShow(options.get("show"));
                    const id = randomUUID();
                    routineIndex.push({ id, name });
                    plan.push({
                        kind: "routine",
                        id,
                        name,
                        projectId,
                        assigneeIds,
                        weekdays,
                        startTime: time,
                        durationMinutes: minutes,
                        storyPoints: resolvePoints(options.get("points")),
                        timeZone: context.timeZone,
                        description: resolveDescription(options.get("description")),
                        ...show,
                    });
                    results.push({
                        line, text, ok: true,
                        summary: `New routine "${name}" on ${options.get("days")!.toLowerCase()}${time ? ` at ${time}` : ""}`,
                        show: { table: show.showInTable, kanban: show.showInKanban, calendar: show.showInCalendar },
                    });
                    break;
                }
                case "routine update": {
                    const { positional, options } = splitArgs(rest, ["id", "days", "time", "duration", "points", "assignee", "show", "active", "description"]);
                    const routine = findRoutine(positional, options);
                    const set: Partial<RoutineFields> = {};
                    if (options.has("days")) set.weekdays = resolveWeekdays(options.get("days"));
                    if (options.has("assignee")) set.assigneeIds = resolveAssignees(options.get("assignee"));
                    if (options.has("points")) set.storyPoints = resolvePoints(options.get("points"));
                    if (options.has("description")) set.description = resolveDescription(options.get("description"));
                    if (options.has("show")) Object.assign(set, parseShow(options.get("show")));
                    if (options.has("active")) {
                        const active = options.get("active")!.toLowerCase();
                        if (active !== "yes" && active !== "no") fail("active: must be yes or no");
                        set.active = active === "yes";
                    }
                    const retime = options.has("time") || options.has("duration");
                    if (retime) {
                        const { time, minutes } = resolveTime(options.get("time"), options.get("duration"));
                        Object.assign(set, { startTime: time, durationMinutes: minutes, timeZone: context.timeZone });
                    }
                    if (Object.keys(set).length === 0) fail("Nothing to change; give at least one option, e.g. days:mon,tue");
                    plan.push({ kind: "routineUpdate", id: routine.id, set, retime });
                    const changed = Object.keys(set).filter((key) => key !== "timeZone" && key !== "durationMinutes");
                    results.push({ line, text, ok: true, summary: `Update routine "${routine.name}": ${changed.join(", ")}` });
                    break;
                }
                case "routine remove": {
                    const { positional, options } = splitArgs(rest, ["id"]);
                    const routine = findRoutine(positional, options);
                    countRemoval();
                    routineIndex.splice(routineIndex.indexOf(routine), 1);
                    plan.push({ kind: "routineRemove", id: routine.id });
                    results.push({ line, text, ok: true, removes: true, summary: `Delete routine "${routine.name}" (tasks it already made stay)` });
                    break;
                }
                case "holiday add": {
                    requireAdmin("add holidays");
                    const { positional } = splitArgs(rest, []);
                    if (positional.length !== 2) fail(`Use: holiday add YYYY-MM-DD "Name"`);
                    const date = resolveDate(positional[0]);
                    const name = positional[1].trim();
                    if (!name || name.length > 80) fail("The holiday needs a name (max 80 characters)");
                    holidays.set(date, name);
                    plan.push({ kind: "holiday", date, name });
                    results.push({ line, text, ok: true, summary: `Day off ${date}: ${name}` });
                    break;
                }
                case "holiday remove": {
                    requireAdmin("remove holidays");
                    const { positional } = splitArgs(rest, []);
                    if (positional.length !== 1) fail("Use: holiday remove YYYY-MM-DD");
                    const date = resolveDate(positional[0]);
                    const name = holidays.get(date);
                    if (name === undefined) fail(`There's no day off on ${date}`);
                    countRemoval();
                    holidays.delete(date);
                    plan.push({ kind: "holidayRemove", date });
                    results.push({ line, text, ok: true, removes: true, summary: `Remove day off ${date}: ${name}` });
                    break;
                }
                default:
                    fail(`"${entity} ${action}" doesn't exist; holidays and placeholders can only be added or removed`);
            }
        } catch (error) {
            if (!(error instanceof LineError)) throw error;
            results.push({ line, text, ok: false, error: error.message });
        }
    });

    return { results, plan };
};

export const sprintDays = (start: string, end: string) =>
    Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;

// Names two members share can't pick one; the planner then asks for an email instead
export const AMBIGUOUS = "__ambiguous__";
