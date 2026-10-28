import "server-only";

import { randomUUID } from "crypto";

import { zonedTimeToUtc } from "@/lib/time-zone";
import { TaskStatus } from "@/features/tasks/types";

// Bulk input (Settings → Bulk input): one command per line. Parsing and planning are pure, so a
// script is fully checked (and any line's problem reported) before anything is written.
//
//   project add "Website v3" start:2026-11-01 end:2026-11-14
//   task add "Hero section" project:"Website v3" assignee:"Sara Rahman, Tom" due:2026-11-03 time:10:00 duration:90 points:3
//   routine add "Standup" project:"Website v3" assignee:me days:sat,sun,mon time:09:30 duration:15 show:table,calendar
//   holiday add 2026-12-31 "Year-end closure"
//   placeholder add "Designer (TBD)" email:designer@example.com
//
// Blank lines and lines starting with # are ignored.

export const MAX_LINES = 500;
export const MAX_SCRIPT_LENGTH = 50_000;

export type Context = {
    // Lower-cased name -> id
    projects: Map<string, string>;
    // Lower-cased name or email -> member id (people and placeholders)
    members: Map<string, string>;
    me: string;
    // Admins; supervisors can't add holidays or placeholders
    canManage: boolean;
    timeZone: string;
    // YYYY-MM-DD in timeZone
    today: string;
};

export type Planned =
    | { kind: "project"; id: string; name: string; start: string | null; end: string | null }
    | { kind: "placeholder"; id: string; name: string; email: string | null }
    | {
        kind: "task"; name: string; projectId: string; assigneeIds: string[]; status: TaskStatus;
        dueDate: Date | null; startAt: Date | null; durationMinutes: number | null; storyPoints: number; description: string | null;
    }
    | {
        kind: "routine"; name: string; projectId: string; assigneeIds: string[]; weekdays: number[];
        startTime: string | null; durationMinutes: number | null; storyPoints: number; timeZone: string;
        showInTable: boolean; showInKanban: boolean; showInCalendar: boolean;
    }
    | { kind: "holiday"; date: string; name: string };

export type LineResult = { line: number; text: string; ok: boolean; summary?: string; error?: string };

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

// Plans every line against the workspace; names created earlier in the script can be used later
export const planScript = (script: string, context: Context) => {
    const lines = script.split(/\r?\n/);
    const results: LineResult[] = [];
    const plan: Planned[] = [];
    const projects = new Map(context.projects);
    const members = new Map(context.members);

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
    const requireManager = (what: string) => {
        if (!context.canManage) fail(`Only admins can add ${what}`);
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
            if (actionToken?.value.toLowerCase() !== "add") fail(`Start with "<project|task|routine|holiday|placeholder> add"`);

            switch (entity) {
                case "project": {
                    const { positional, options } = splitArgs(rest, ["start", "end"]);
                    const name = requireName(positional, "project");
                    if (projects.has(name.toLowerCase())) fail(`There's already a project called "${name}"`);
                    const start = options.has("start") ? resolveDate(options.get("start")!) : null;
                    const end = options.has("end") ? resolveDate(options.get("end")!) : null;
                    if ((start === null) !== (end === null)) fail("Give both start: and end:, or neither");
                    if (start && end && end < start) fail("end: is before start:");
                    const id = randomUUID();
                    projects.set(name.toLowerCase(), id);
                    plan.push({ kind: "project", id, name, start, end });
                    results.push({ line, text, ok: true, summary: `New project "${name}"${start ? ` (sprint ${start} to ${end})` : ""}` });
                    break;
                }
                case "placeholder": {
                    const { positional, options } = splitArgs(rest, ["email"]);
                    requireManager("placeholders");
                    const name = requireName(positional, "placeholder");
                    if (name.length > 60) fail("The placeholder name is too long (max 60 characters)");
                    if (members.has(name.toLowerCase())) fail(`"${name}" is already a member or placeholder`);
                    const email = options.get("email")?.toLowerCase() || null;
                    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(`"${email}" isn't an email address`);
                    const id = randomUUID();
                    members.set(name.toLowerCase(), id);
                    if (email) members.set(email, id);
                    plan.push({ kind: "placeholder", id, name, email });
                    results.push({ line, text, ok: true, summary: `New placeholder "${name}"${email ? ` for ${email}` : ""}` });
                    break;
                }
                case "task": {
                    const { positional, options } = splitArgs(rest, ["project", "assignee", "status", "due", "time", "duration", "points", "description"]);
                    const name = requireName(positional, "task");
                    const projectId = resolveProject(options.get("project"));
                    const assigneeIds = resolveAssignees(options.get("assignee"));
                    const statusText = options.get("status")?.toLowerCase();
                    const status = statusText ? STATUSES[statusText] : TaskStatus.TODO;
                    if (!status) fail(`status: must be one of ${Object.keys(STATUSES).filter((key) => !key.includes("-")).join(", ")}`);
                    const due = options.has("due") ? resolveDate(options.get("due")!) : null;
                    const { time, minutes } = resolveTime(options.get("time"), options.get("duration"));
                    if (time && !due) fail("time: needs a due: date");
                    const [year, month, day] = (due ?? "").split("-").map(Number);
                    const description = options.get("description") ?? null;
                    if (description && description.length > 5000) fail("description: is too long (max 5000 characters)");
                    plan.push({
                        kind: "task",
                        name,
                        projectId,
                        assigneeIds,
                        status,
                        // Same convention as the task form: the day's start in the author's time zone
                        dueDate: due ? zonedTimeToUtc(year, month, day, "00:00", context.timeZone) : null,
                        startAt: due && time ? zonedTimeToUtc(year, month, day, time, context.timeZone) : null,
                        durationMinutes: minutes,
                        storyPoints: resolvePoints(options.get("points")),
                        description,
                    });
                    results.push({ line, text, ok: true, summary: `New task "${name}"${due ? ` due ${due}${time ? ` at ${time}` : ""}` : ""}` });
                    break;
                }
                case "routine": {
                    const { positional, options } = splitArgs(rest, ["project", "assignee", "days", "time", "duration", "points", "show"]);
                    const name = requireName(positional, "routine");
                    const projectId = resolveProject(options.get("project"));
                    const assigneeIds = resolveAssignees(options.get("assignee"));
                    const daysText = options.get("days")?.toLowerCase();
                    if (!daysText) fail("days: is required, e.g. days:sat,sun,mon or days:daily");
                    const weekdays = daysText === "daily"
                        ? [1, 2, 3, 4, 5, 6, 7]
                        : daysText!.split(",").map((part) => {
                            const value = DAY_NAMES[part.trim().slice(0, 3)];
                            if (!value) fail(`"${part}" isn't a weekday; use sat, sun, mon, tue, wed, thu, fri`);
                            return value;
                        });
                    const { time, minutes } = resolveTime(options.get("time"), options.get("duration"));
                    plan.push({
                        kind: "routine",
                        name,
                        projectId,
                        assigneeIds,
                        weekdays: Array.from(new Set(weekdays)).sort(),
                        startTime: time,
                        durationMinutes: minutes,
                        storyPoints: resolvePoints(options.get("points")),
                        timeZone: context.timeZone,
                        ...parseShow(options.get("show")),
                    });
                    results.push({ line, text, ok: true, summary: `New routine "${name}" on ${daysText}${time ? ` at ${time}` : ""}` });
                    break;
                }
                case "holiday": {
                    requireManager("holidays");
                    const { positional } = splitArgs(rest, []);
                    if (positional.length !== 2) fail(`Use: holiday add YYYY-MM-DD "Name"`);
                    const date = resolveDate(positional[0]);
                    const name = positional[1].trim();
                    if (!name || name.length > 80) fail("The holiday needs a name (max 80 characters)");
                    plan.push({ kind: "holiday", date, name });
                    results.push({ line, text, ok: true, summary: `Day off ${date}: ${name}` });
                    break;
                }
                default:
                    fail(`Unknown "${entity}"; use project, task, routine, holiday or placeholder`);
            }
        } catch (error) {
            if (!(error instanceof LineError)) throw error;
            results.push({ line, text, ok: false, error: error.message });
        }
    });

    return { results, plan };
};

// Names two members share can't pick one; the planner then asks for an email instead
export const AMBIGUOUS = "__ambiguous__";
