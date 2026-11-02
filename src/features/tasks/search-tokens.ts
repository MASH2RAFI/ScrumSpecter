import { TaskStatus } from "./types";

// My Tasks' search box, in plain words. Recognised words filter; the rest search task names:
//   statuses   backlog · to do / todo · doing / in progress · review / in review · done / finished
//   people     a teammate's name (first name is enough), or me / mine / my
//   projects   a project's name (its first word is enough), or "no project" / personal
//   flags      starred · overdue / late · today · tomorrow
// "Quoted words" always search names. The older forms still work: status:done, @theo,
// project:web, is:starred, due:today.
export type SearchTokens = {
    text: string;
    statuses?: TaskStatus[];
    // Member ids, or "me"
    people?: string[];
    projectId?: string;
    starred?: true;
    overdue?: true;
    // A due-date range: [from, to)
    due?: { from: Date; to: Date };
    // What was recognised, to show under the box
    understood: string[];
};

type Named = { id: string; name: string };

const STATUS_PHRASES: [string[], TaskStatus, string][] = [
    [["in", "progress"], TaskStatus.IN_PROGRESS, "In Progress"],
    [["in", "review"], TaskStatus.IN_REVIEW, "In Review"],
    [["to", "do"], TaskStatus.TODO, "Todo"],
    [["todo"], TaskStatus.TODO, "Todo"],
    [["backlog"], TaskStatus.BACKLOG, "Backlog"],
    [["doing"], TaskStatus.IN_PROGRESS, "In Progress"],
    [["progress"], TaskStatus.IN_PROGRESS, "In Progress"],
    [["inprogress"], TaskStatus.IN_PROGRESS, "In Progress"],
    [["review"], TaskStatus.IN_REVIEW, "In Review"],
    [["inreview"], TaskStatus.IN_REVIEW, "In Review"],
    [["done"], TaskStatus.DONE, "Done"],
    [["finished"], TaskStatus.DONE, "Done"],
    [["completed"], TaskStatus.DONE, "Done"],
];
const ME_WORDS = new Set(["me", "mine", "my"]);

const startOfDay = (offset: number, now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Words and "quoted phrases" (kept as name searches)
const split = (search: string) => [...search.matchAll(/"([^"]*)"|(\S+)/g)]
    .map((m) => (m[1] !== undefined ? { word: m[1], quoted: true } : { word: m[2], quoted: false }))
    .filter((part) => part.word);

export const parseSearch = (search: string | null | undefined, people: Named[], projects: Named[], now = new Date()): SearchTokens => {
    const result: SearchTokens = { text: "", understood: [] };
    const words: string[] = [];
    const addStatus = (status: TaskStatus, label: string) => {
        if (result.statuses?.includes(status)) return;
        result.statuses = [...(result.statuses ?? []), status];
        result.understood.push(label);
    };
    const addPeople = (ids: string[], label: string) => {
        result.people = [...(result.people ?? []), ...ids];
        result.understood.push(label);
    };
    const setDue = (offset: number, label: string) => {
        result.due = { from: startOfDay(offset, now), to: startOfDay(offset + 1, now) };
        result.understood.push(label);
    };
    // A person by first name or full name (2+ letters), or a project by its name's start (3+)
    const person = (word: string) => people.filter((p) => {
        const name = p.name.toLowerCase();
        return word.length >= 2 && (name.split(/\s+/).some((part) => part.startsWith(word)) || squash(name).startsWith(word));
    });
    const project = (word: string) => (word.length >= 3 ? projects.find((p) => squash(p.name).startsWith(word)) : undefined);

    const parts = split((search ?? "").trim());
    for (let i = 0; i < parts.length; i++) {
        const { word, quoted } = parts[i];
        if (quoted) { words.push(word); continue; }
        const lower = word.toLowerCase();
        const next = parts[i + 1] && !parts[i + 1].quoted ? parts[i + 1].word.toLowerCase() : undefined;

        // The older field forms
        const field = lower.match(/^(status|project|is|due):(.+)$/);
        if (lower.startsWith("@") && lower.length > 1) {
            const name = lower.slice(1);
            if (ME_WORDS.has(name)) addPeople(["me"], "Me");
            else {
                const found = person(squash(name));
                addPeople(found.length ? found.map((p) => p.id) : ["nobody"], found.length ? found.map((p) => p.name).join(" or ") : `nobody called ${name}`);
            }
            continue;
        }
        if (field) {
            const [, key, value] = field;
            const status = STATUS_PHRASES.find(([phrase]) => phrase.join("") === squash(value));
            if (key === "status" && status) { addStatus(status[1], status[2]); continue; }
            if (key === "project") {
                const found = project(squash(value));
                result.projectId = found?.id ?? "nothing";
                result.understood.push(found ? found.name : `no project called ${value}`);
                continue;
            }
            if (key === "is" && value === "starred") { result.starred = true; result.understood.push("Starred"); continue; }
            if (key === "due" && value === "today") { setDue(0, "Due today"); continue; }
            if (key === "due" && value === "tomorrow") { setDue(1, "Due tomorrow"); continue; }
            if (key === "due" && value === "overdue") { result.overdue = true; result.understood.push("Overdue"); continue; }
        }

        // Two-word phrases first: "in review", "to do", "no project"
        const pair = STATUS_PHRASES.find(([phrase]) => phrase.length === 2 && phrase[0] === lower && phrase[1] === next);
        if (pair) { addStatus(pair[1], pair[2]); i++; continue; }
        if (lower === "no" && next === "project") { result.projectId = "none"; result.understood.push("No project"); i++; continue; }

        const single = STATUS_PHRASES.find(([phrase]) => phrase.length === 1 && phrase[0] === lower);
        if (single) { addStatus(single[1], single[2]); continue; }
        if (ME_WORDS.has(lower)) { addPeople(["me"], "Me"); continue; }
        if (lower === "starred" || lower === "favourite" || lower === "favorite") { result.starred = true; result.understood.push("Starred"); continue; }
        if (lower === "overdue" || lower === "late") { result.overdue = true; result.understood.push("Overdue"); continue; }
        if (lower === "today") { setDue(0, "Due today"); continue; }
        if (lower === "tomorrow") { setDue(1, "Due tomorrow"); continue; }
        if (lower === "personal") { result.projectId = "none"; result.understood.push("No project"); continue; }

        const found = person(squash(lower));
        if (found.length) { addPeople(found.map((p) => p.id), found.map((p) => p.name).join(" or ")); continue; }
        const proj = !result.projectId ? project(squash(lower)) : undefined;
        if (proj) { result.projectId = proj.id; result.understood.push(proj.name); continue; }
        words.push(word);
    }
    result.text = words.join(" ");
    if (result.text) result.understood.push(`name has "${result.text}"`);
    return result;
};
