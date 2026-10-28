"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, ClipboardCopyIcon, PlayIcon, XCircleIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { client } from "@/lib/rpc";
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

// Settings → Bulk input (admins and supervisors): many changes at once, checked line by line
// before anything is saved
export const BulkInput = ({ workspace, canManage }: { workspace: Workspace; canManage: boolean }) => {
    const queryClient = useQueryClient();
    const { timeZone } = usePreferences();
    const { data: projects } = useGetProjects({ workspaceId: workspace.$id });
    const { data: members } = useGetMembers({ workspaceId: workspace.$id });
    const [script, setScript] = useState("");
    const [results, setResults] = useState<LineResult[] | null>(null);
    const [checkedScript, setCheckedScript] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    const run = async (apply: boolean) => {
        setPending(true);
        try {
            const response = await client.api.workspaces[":workspaceId"].bulk.$post({ param: { workspaceId: workspace.$id }, json: { script, apply } });
            const body = await response.json().catch(() => ({})) as { data?: { results: LineResult[]; applied: boolean; counts: Record<string, number> | null }; error?: string };
            if (!response.ok || !body.data) throw new Error(body.error ?? "Couldn't run the script");
            setResults(body.data.results);
            setCheckedScript(script);
            if (body.data.applied) {
                const done = Object.entries(body.data.counts ?? {}).map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`).join(", ");
                toast.success(`Added ${done}`);
                setScript("");
                setCheckedScript(null);
                for (const key of ["projects", "tasks", "routines", "members", "holidays"]) {
                    queryClient.invalidateQueries({ queryKey: [key] });
                }
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
    const canApply = results !== null && badLines === 0 && okLines > 0 && checkedScript === script;

    const copyPrompt = async () => {
        const projectNames = projects?.documents.map((project) => `"${project.name}"`).join(", ") || "(none yet)";
        const memberNames = members?.documents
            .filter((member) => member.role !== MemberRole.VIEWER)
            .map((member) => `"${member.name}"${member.isPlaceholder ? " (placeholder)" : ""}`).join(", ") || "(none)";
        const prompt = [
            "You write commands for ScrumSpecter's Bulk input box. Reply with ONLY the commands, one per line, inside a single ```text code block. No explanations.",
            "",
            "## Command language",
            BULK_SYNTAX,
            "",
            "## This workspace",
            `- Workspace: "${workspace.name}"`,
            `- Existing projects: ${projectNames}`,
            `- Existing members and placeholders: ${memberNames}`,
            `- Today is ${new Date().toISOString().slice(0, 10)}; times are in ${timeZone}. Working hours are ${workspace.workDayStart}–${workspace.workDayEnd}.`,
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
            await navigator.clipboard.writeText(prompt);
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
                        <p className="text-sm text-muted-foreground">
                            Add many projects, tasks{canManage ? ", routines, days off or placeholders" : " or routines"} at once.
                        </p>
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
                    <Button variant="secondary" disabled={pending || !script.trim()} onClick={() => run(false)}>
                        <CheckCircle2Icon className="mr-1.5 size-4" />
                        Check
                    </Button>
                    <Button disabled={pending || !canApply} onClick={() => run(true)}>
                        <PlayIcon className="mr-1.5 size-4" />
                        Apply{canApply ? ` ${okLines} ${okLines === 1 ? "change" : "changes"}` : ""}
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
