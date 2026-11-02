"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ClipboardCopyIcon, PlayIcon, Trash2Icon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client } from "@/lib/rpc";
import { useCurrent } from "@/features/auth/api/use-current";
import { usePreferences } from "@/features/auth/hooks/use-preferences";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { MemberRole } from "@/features/members/types";
import { canEditWork, canManageWorkspace } from "@/features/members/permissions";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { restoreTasks, toastWithUndo } from "@/features/tasks/api/undo";
import { useConfirm } from "@/hooks/use-confirm";

import type { LineResult } from "../server/bulk-input";
import { Workspace } from "../types";

type Views = NonNullable<LineResult["show"]>;

// The command language, shown in the tab and included in the AI prompt
export const BULK_SYNTAX = `One command per line. Put names and text in "double quotes". Lines starting with # are comments.

project add "<name>" [start:YYYY-MM-DD end:YYYY-MM-DD]
task add "<name>" [project:"<project>"] [assignee:"<member name or email>[, <another>...]"|me] [status:backlog|todo|in_progress|in_review|done] [due:YYYY-MM-DD|today|tomorrow] [time:HH:MM] [duration:<minutes>|<hours>h] [points:1-100] [description:"<text>"]
routine add "<name>" [project:"<project>"] [assignee:"<member>[, <another>...]"|me] days:sat,sun,mon,tue,wed,thu,fri|daily [time:HH:MM] [duration:<minutes>|<hours>h] [points:1-100] [show:table,kanban,calendar|none] [description:"<text>"]
holiday add YYYY-MM-DD "<name>"                (admins only)
placeholder add "<name>" [email:<address>]     (admins only)

task update "<name>"|id:<task id> [project:"<project>"] [name:"<new name>"] [status:…] [due:YYYY-MM-DD|today|tomorrow|none] [time:HH:MM] [duration:…] [points:1-100] [assignee:…] [description:"<text>"]
task remove "<name>"|id:<task id> [project:"<project>"]
routine update "<name>"|id:<routine id> [days:…] [time:HH:MM] [duration:…] [points:1-100] [assignee:…] [show:…] [active:yes|no] [description:"<text>"]
routine remove "<name>"|id:<routine id>
project update "<name>" [name:"<new name>"] [start:YYYY-MM-DD end:YYYY-MM-DD]   (sprint dates: admins only)
project remove "<name>"                        (admins only; deletes its tasks too)
holiday remove YYYY-MM-DD                      (admins only)
placeholder remove "<name>"                    (admins only)

Rules:
- time: is 24-hour HH:MM in the person's time zone, and needs due: on tasks. duration: needs time: (5 minutes to 24 hours; default 30).
- Without due:, a task has no date. Without assignee:, it's assigned to whoever runs the script ("me").
- Several assignees go in one assignee: option, separated by commas, e.g. assignee:"Sara Rahman, me".
- Routines repeat every week on their days:. Use day names separated by commas (sat,sun,mon or saturday,sunday,monday), or daily. Without time:, a routine is all day.
- A routine creates one task per day, from today through the end of its project's sprint (a week ahead if the project has no sprint), skipping public holidays and days off.
- show: picks which task views list a routine's tasks (any of table, kanban, calendar; default all three). show:none keeps them to Home and My work.
- Without project:, a task or routine is personal (no project); a personal routine keeps its next 14 days filled.
- project: and assignee: must match an existing project/member exactly (case doesn't matter), or one added earlier in the same script.
- Projects need both start: and end: (the sprint), or neither.
- update and remove find the item by its exact name (case doesn't matter). If two tasks share a name, add project: or use id:. On update, project: only narrows the search; it doesn't move the task.
- On task update, due: without time: makes the task all day, and due:none clears the date. Options left out stay as they are.
- A script removes at most 50 items. Removing a routine keeps the tasks it already made.
- Reviewers and assignees can only add tasks: tasks assigned only to themselves are saved, and tasks for anyone else are sent to an admin or supervisor for approval.`;

const EXAMPLE = `# Example
project add "Website v3" start:2026-11-01 end:2026-11-14
placeholder add "Designer (TBD)" email:designer@example.com
task add "Hero section" project:"Website v3" assignee:"Designer (TBD), me" due:2026-11-03 time:10:00 duration:90 points:3
task add "Write release notes" project:"Website v3" due:tomorrow
routine add "Standup" project:"Website v3" assignee:me days:sat,sun,mon,tue,wed time:09:30 duration:15 description:"Yesterday, today, blockers"
holiday add 2026-12-31 "Year-end closure"`;

// workspaceId: the workspace bulk setup created (setup only); removed: deleted tasks, for Undo
type RunResult = {
    results: LineResult[]; applied: boolean; counts: Record<string, number> | null;
    workspaceId?: string | null; removed?: Record<string, unknown>[];
};

// What the AI prompt tells the assistant about where the commands will run
type PromptContext = {
    workspaceName: string;
    projectNames: string;
    memberNames: string;
    workDay?: string;
    role: MemberRole;
};

// Everything but adds; adds read "Added 2 tasks, 1 routine"
const OTHER_COUNTS: Record<string, string> = {
    request: "task request{s} sent for approval",
    taskUpdate: "task{s} updated",
    routineUpdate: "routine{s} updated",
    projectUpdate: "project{s} updated",
    taskRemove: "task{s} deleted",
    routineRemove: "routine{s} deleted",
    projectRemove: "project{s} deleted",
    holidayRemove: "day{s} off removed",
    placeholderRemove: "placeholder{s} removed",
};

const summarize = (counts: Record<string, number> | null) => {
    const entries = Object.entries(counts ?? {});
    const plural = (count: number) => (count === 1 ? "" : "s");
    const added = entries.filter(([kind]) => !OTHER_COUNTS[kind]).map(([kind, count]) => `${count} ${kind}${plural(count)}`);
    const other = entries.filter(([kind]) => OTHER_COUNTS[kind]).map(([kind, count]) => `${count} ${OTHER_COUNTS[kind].replace("{s}", plural(count))}`);
    return [added.length ? `Added ${added.join(", ")}` : "", ...other].filter(Boolean).join("; ");
};

const VIEWS = ["table", "kanban", "calendar"] as const;

// A routine line with its show: option set to these views. shortcut: also matches "show:" inside a
// quoted name; the next check would then report it, fine until names like that turn up.
const withShow = (line: string, views: Views) => {
    const value = VIEWS.filter((view) => views[view]).join(",") || "none";
    const option = /(^|\s)show:\S*/i;
    return option.test(line) ? line.replace(option, `$1show:${value}`) : `${line.trimEnd()} show:${value}`;
};

// What each role may write, for the AI prompt
const roleRules = (role: MemberRole) => {
    if (canEditWork(role)) {
        return canManageWorkspace(role) ? [] : [
            "- Don't use holiday or placeholder commands, project remove, or project start:/end: changes; I'm a supervisor, not an admin.",
        ];
    }
    return [
        "- I'm a reviewer or assignee: use ONLY task add. Tasks assigned only to me (or with no assignee:) are saved; tasks for anyone else are sent to an admin or supervisor for approval.",
        "- Don't add projects, routines, holidays or placeholders, and don't update or remove anything; those lines would fail.",
    ];
};

// The editor itself: commands in, line-by-line check, then apply. `run` sends the script to the
// workspace's bulk endpoint or, when setting up a new workspace, to /setup.
const BulkEditor = ({ run, prompt, applyLabel = "Apply", disabled, onApplied, intro }: {
    run: (script: string, apply: boolean) => Promise<RunResult>;
    prompt: () => PromptContext;
    applyLabel?: string;
    // Something else on the page still needs filling in (the new workspace's name)
    disabled?: boolean;
    onApplied: (result: RunResult) => void;
    intro: React.ReactNode;
}) => {
    const { timeZone } = usePreferences();
    const [script, setScript] = useState("");
    const [results, setResults] = useState<LineResult[] | null>(null);
    const [checkedScript, setCheckedScript] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const go = async (apply: boolean) => {
        setPending(true);
        try {
            const result = await run(script, apply);
            setResults(result.results);
            setCheckedScript(script);
            if (result.applied) {
                setScript("");
                setCheckedScript(null);
                onApplied(result);
            }
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setPending(false);
        }
    };

    const okLines = results?.filter((result) => result.ok).length ?? 0;
    const badLines = results?.filter((result) => !result.ok).length ?? 0;
    const removals = results?.filter((result) => result.ok && result.removes).length ?? 0;
    // Apply only what was checked, and only when every line passed
    const canApply = !disabled && results !== null && badLines === 0 && okLines > 0 && checkedScript === script;
    const [ConfirmDialog, confirmRemoval] = useConfirm(
        `Delete ${removals} ${removals === 1 ? "item" : "items"}?`,
        "The check results list exactly what goes. Deleted tasks can be brought back with Undo right after; projects, routines, days off and placeholders can't.",
        "destructive",
    );

    const apply = async () => {
        if (removals > 0 && !(await confirmRemoval())) return;
        await go(true);
    };

    // The toggles rewrite the line's show:, so the script stays the source of truth; a check that
    // passed still holds, since show: can't make a line fail
    const toggleView = (result: LineResult, view: typeof VIEWS[number]) => {
        const views = { ...result.show!, [view]: !result.show![view] };
        const lines = script.split("\n");
        lines[result.line - 1] = withShow(lines[result.line - 1], views);
        const next = lines.join("\n");
        if (checkedScript === script) setCheckedScript(next);
        setScript(next);
        setResults((current) => current?.map((item) => (item.line === result.line ? { ...item, show: views } : item)) ?? null);
    };

    const copyPrompt = async () => {
        const { workspaceName, projectNames, memberNames, workDay, role } = prompt();
        const text = [
            "You write commands for ScrumSpecter's Bulk input box. Reply with ONLY the commands, one per line, inside a single ```text code block. No explanations.",
            "",
            "## Command language",
            BULK_SYNTAX,
            "",
            "## This workspace",
            `- Workspace: "${workspaceName}"`,
            `- Existing projects: ${projectNames}`,
            `- Existing members and placeholders: ${memberNames}`,
            `- Today is ${new Date().toISOString().slice(0, 10)}; times are in ${timeZone}.${workDay ? ` Working hours are ${workDay}.` : ""}`,
            "",
            "## Don'ts",
            "- Don't invent options, commands or statuses that aren't listed above.",
            "- Don't refer to a project or member that isn't listed above unless your script adds it first (project add / placeholder add).",
            "- Use update and remove only on items that exist (or that the script adds first), by their exact name.",
            ...roleRules(role),
            "",
            "## Example",
            EXAMPLE,
            "",
            "## What I need",
            "<describe the tasks, routines, projects, holidays or placeholders you want here>",
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            toast.success("AI prompt copied. Paste it into your AI assistant and fill in the last part.");
        } catch {
            toast.error("Couldn't copy; your browser blocked the clipboard");
        }
    };

    return (
        <div className="space-y-4">
            <section className="space-y-3 rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h3 className="font-semibold">Bulk input</h3>
                        <p className="text-sm text-muted-foreground">{intro}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={copyPrompt}>
                        <ClipboardCopyIcon className="mr-1.5 size-4" />
                        Copy AI prompt
                    </Button>
                </div>

                <Label htmlFor="bulk-script" className="sr-only">Commands</Label>
                <Textarea
                    id="bulk-script"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder={EXAMPLE}
                    rows={10}
                    spellCheck={false}
                    className="font-mono text-xs leading-5"
                />

                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" disabled={pending || !script.trim()} onClick={() => go(false)}>
                        <CheckCircle2Icon className="mr-1.5 size-4" />
                        Check
                    </Button>
                    {canApply && removals > 0 ? (
                        <Button variant="destructive" disabled={pending} onClick={apply}>
                            <Trash2Icon className="mr-1.5 size-4" />
                            Delete {removals} {removals === 1 ? "item" : "items"}…
                        </Button>
                    ) : (
                        <Button disabled={pending || !canApply} onClick={apply}>
                            <PlayIcon className="mr-1.5 size-4" />
                            {applyLabel}{canApply ? ` ${okLines} ${okLines === 1 ? "change" : "changes"}` : ""}
                        </Button>
                    )}
                    {results && checkedScript !== script && (
                        <span className="text-xs text-muted-foreground">Changed since the check. Check again to apply.</span>
                    )}
                </div>

                {results && (
                    <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2 text-xs" aria-label="Check results">
                        {results.length === 0 && <li className="text-muted-foreground">No commands found.</li>}
                        {results.map((result) => (
                            <li key={result.line} className={cn("flex items-start gap-2", !result.ok && "text-destructive")}>
                                {result.ok
                                    ? <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                                    : <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />}
                                <span className="w-12 shrink-0 text-muted-foreground">Line {result.line}</span>
                                <span className={cn(result.removes && "text-destructive")}>{result.ok ? result.summary : result.error}</span>
                                {result.outcome && (
                                    <span className="ml-auto shrink-0 rounded bg-muted px-1.5 text-muted-foreground">
                                        {result.outcome === "saved" ? "Saved" : "Sent for approval"}
                                    </span>
                                )}
                                {result.show && (
                                    <span role="group" aria-label={`Views for line ${result.line}`} className="ml-auto flex shrink-0 gap-1">
                                        {VIEWS.map((view) => (
                                            <button
                                                key={view}
                                                type="button"
                                                aria-pressed={result.show![view]}
                                                onClick={() => toggleView(result, view)}
                                                className={cn(
                                                    "rounded border px-1.5 capitalize",
                                                    result.show![view] ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground line-through",
                                                )}
                                            >
                                                {view}
                                            </button>
                                        ))}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <details className="rounded-lg border p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Command reference</summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground">{BULK_SYNTAX}</pre>
            </details>
            <ConfirmDialog />
        </div>
    );
};

const readBody = async (response: Response) => {
    const body = await response.json().catch(() => ({})) as { data?: RunResult; error?: string };
    if (!response.ok || !body.data) throw new Error(body.error ?? "Couldn't run the script");
    return body.data;
};

// Settings → Bulk input: many changes at once, checked line by line before anything is saved.
// Admins and supervisors write directly; reviewers and assignees add tasks (others' go for approval).
export const BulkInput = ({ workspace, role }: { workspace: Workspace; role: MemberRole }) => {
    const queryClient = useQueryClient();
    const { data: projects } = useGetProjects({ workspaceId: workspace.$id });
    const { data: members } = useGetMembers({ workspaceId: workspace.$id });

    return (
        <BulkEditor
            intro={canEditWork(role)
                ? `Add, change or remove many projects, tasks${canManageWorkspace(role) ? ", routines, days off or placeholders" : " or routines"} at once.`
                : "Add many tasks at once. Tasks only for you are saved straight away; tasks for anyone else are sent to an admin or supervisor for approval."}
            run={async (script, apply) => readBody(await client.api.workspaces[":workspaceId"].bulk.$post({ param: { workspaceId: workspace.$id }, json: { script, apply } }))}
            prompt={() => ({
                workspaceName: workspace.name,
                projectNames: projects?.documents.map((project) => `"${project.name}"`).join(", ") || "(none yet)",
                memberNames: members?.documents
                    .filter((member) => member.role !== MemberRole.VIEWER)
                    .map((member) => `"${member.name}"${member.isPlaceholder ? " (placeholder)" : ""}`).join(", ") || "(none)",
                workDay: `${workspace.workDayStart}–${workspace.workDayEnd}`,
                role,
            })}
            onApplied={(result) => {
                const message = summarize(result.counts);
                const removed = result.removed ?? [];
                if (removed.length) toastWithUndo(message, () => restoreTasks(queryClient, removed));
                else toast.success(message);
                for (const key of ["projects", "tasks", "routines", "members", "holidays", "change-requests"]) {
                    queryClient.invalidateQueries({ queryKey: [key] });
                }
            }}
        />
    );
};

// Getting started: a new workspace set up in one go from commands. Nothing is created until the
// commands pass the check and are applied.
export const BulkSetup = () => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { data: user } = useCurrent();
    const [name, setName] = useState("");

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="setup-workspace-name">Workspace name</Label>
                <Input
                    id="setup-workspace-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fall launch"
                    maxLength={100}
                />
            </div>
            <BulkEditor
                intro="Describe your projects, tasks, routines, days off and teammates-to-be as commands. They're checked first; the workspace is created only when you apply them."
                applyLabel="Create workspace with"
                disabled={!name.trim()}
                run={async (script, apply) => readBody(await client.api.workspaces.setup.$post({ json: { name: name.trim() || "New workspace", script, apply } }))}
                prompt={() => ({
                    workspaceName: name.trim() || "New workspace",
                    projectNames: "(none yet)",
                    memberNames: user ? `"${user.name}" (me)` : "(just me)",
                    role: MemberRole.ADMIN,
                })}
                onApplied={(result) => {
                    toast.success(`Workspace created with ${summarize(result.counts).replace(/^Added /, "")}`);
                    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
                    if (result.workspaceId) router.push(`/workspaces/${result.workspaceId}`);
                }}
            />
        </div>
    );
};
