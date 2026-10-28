"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ClipboardCopyIcon, PlayIcon, XCircleIcon } from "lucide-react";
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
import { useGetProjects } from "@/features/projects/api/use-get-projects";

import { Workspace } from "../types";

type LineResult = { line: number; text: string; ok: boolean; summary?: string; error?: string };

// The command language, shown in the tab and included in the AI prompt
export const BULK_SYNTAX = `One command per line. Put names and text in "double quotes". Lines starting with # are comments.

project add "<name>" [start:YYYY-MM-DD end:YYYY-MM-DD]
task add "<name>" project:"<project>" [assignee:"<member name or email>[, <another>...]"|me] [status:backlog|todo|in_progress|in_review|done] [due:YYYY-MM-DD|today|tomorrow] [time:HH:MM] [duration:<minutes>|<hours>h] [points:1-100] [description:"<text>"]
routine add "<name>" project:"<project>" [assignee:"<member>[, <another>...]"|me] days:sat,sun,mon,tue,wed,thu,fri|daily [time:HH:MM] [duration:<minutes>|<hours>h] [points:1-100] [show:table,kanban,calendar|none]
holiday add YYYY-MM-DD "<name>"                (admins only)
placeholder add "<name>" [email:<address>]     (admins only)

Rules:
- time: is 24-hour HH:MM in the person's time zone, and needs due: on tasks. duration: needs time: (5 minutes to 24 hours; default 30).
- Without due:, a task has no date. Without assignee:, it's assigned to whoever runs the script ("me").
- Several assignees go in one assignee: option, separated by commas, e.g. assignee:"Sara Rahman, me".
- Routines repeat every week on their days:. Use day names separated by commas (sat,sun,mon or saturday,sunday,monday), or daily. Without time:, a routine is all day.
- A routine creates one task per day, from today through the end of its project's sprint (a week ahead if the project has no sprint), skipping public holidays and days off.
- show: picks which task views list a routine's tasks (any of table, kanban, calendar; default all three). show:none keeps them to Home and My work.
- project: and assignee: must match an existing project/member exactly (case doesn't matter), or one added earlier in the same script.
- Projects need both start: and end: (the sprint), or neither.`;

const EXAMPLE = `# Example
project add "Website v3" start:2026-11-01 end:2026-11-14
placeholder add "Designer (TBD)" email:designer@example.com
task add "Hero section" project:"Website v3" assignee:"Designer (TBD), me" due:2026-11-03 time:10:00 duration:90 points:3
task add "Write release notes" project:"Website v3" due:tomorrow
routine add "Standup" project:"Website v3" assignee:me days:sat,sun,mon,tue,wed time:09:30 duration:15
holiday add 2026-12-31 "Year-end closure"`;

// workspaceId: the workspace bulk setup created (setup only)
type RunResult = { results: LineResult[]; applied: boolean; counts: Record<string, number> | null; workspaceId?: string | null };

// What the AI prompt tells the assistant about where the commands will run
type PromptContext = {
    workspaceName: string;
    projectNames: string;
    memberNames: string;
    workDay?: string;
    canManage: boolean;
};

const summarize = (counts: Record<string, number> | null) =>
    Object.entries(counts ?? {}).map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`).join(", ");

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
    // Apply only what was checked, and only when every line passed
    const canApply = !disabled && results !== null && badLines === 0 && okLines > 0 && checkedScript === script;

    const copyPrompt = async () => {
        const { workspaceName, projectNames, memberNames, workDay, canManage } = prompt();
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
            "- Don't use update or delete commands; only \"add\" exists.",
            ...(canManage ? [] : ["- Don't use holiday add or placeholder add; I'm not an admin."]),
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
                    <Button disabled={pending || !canApply} onClick={() => go(true)}>
                        <PlayIcon className="mr-1.5 size-4" />
                        {applyLabel}{canApply ? ` ${okLines} ${okLines === 1 ? "change" : "changes"}` : ""}
                    </Button>
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
                                <span>{result.ok ? result.summary : result.error}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <details className="rounded-lg border p-4 text-sm">
                <summary className="cursor-pointer font-semibold">Command reference</summary>
                <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground">{BULK_SYNTAX}</pre>
            </details>
        </div>
    );
};

const readBody = async (response: Response) => {
    const body = await response.json().catch(() => ({})) as { data?: RunResult; error?: string };
    if (!response.ok || !body.data) throw new Error(body.error ?? "Couldn't run the script");
    return body.data;
};

// Settings → Bulk input (admins and supervisors): many changes at once, checked line by line
// before anything is saved
export const BulkInput = ({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) => {
    const queryClient = useQueryClient();
    const { data: projects } = useGetProjects({ workspaceId: workspace.$id });
    const { data: members } = useGetMembers({ workspaceId: workspace.$id });

    return (
        <BulkEditor
            intro={`Add many projects, tasks${canManage ? ", routines, days off or placeholders" : " or routines"} at once.`}
            run={async (script, apply) => readBody(await client.api.workspaces[":workspaceId"].bulk.$post({ param: { workspaceId: workspace.$id }, json: { script, apply } }))}
            prompt={() => ({
                workspaceName: workspace.name,
                projectNames: projects?.documents.map((project) => `"${project.name}"`).join(", ") || "(none yet)",
                memberNames: members?.documents
                    .filter((member) => member.role !== MemberRole.VIEWER)
                    .map((member) => `"${member.name}"${member.isPlaceholder ? " (placeholder)" : ""}`).join(", ") || "(none)",
                workDay: `${workspace.workDayStart}–${workspace.workDayEnd}`,
                canManage,
            })}
            onApplied={(result) => {
                toast.success(`Added ${summarize(result.counts)}`);
                for (const key of ["projects", "tasks", "routines", "members", "holidays"]) {
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
                    canManage: true,
                })}
                onApplied={(result) => {
                    toast.success(`Workspace created with ${summarize(result.counts)}`);
                    queryClient.invalidateQueries({ queryKey: ["workspaces"] });
                    if (result.workspaceId) router.push(`/workspaces/${result.workspaceId}`);
                }}
            />
        </div>
    );
};
