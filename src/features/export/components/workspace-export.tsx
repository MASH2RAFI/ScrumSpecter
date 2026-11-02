"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { downloadFrom } from "../download";

const Item = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
);

// Workspace settings → Export: every task (CSV, calendar) for any member; the bulk-input script
// and the JSON backup for Admins
export const WorkspaceExport = ({ workspaceId, isAdmin }: { workspaceId: string; isAdmin: boolean }) => {
    const [pending, setPending] = useState<string | null>(null);
    const [withEmails, setWithEmails] = useState(false);

    const run = async (key: string, url: string, filename: string) => {
        setPending(key);
        try {
            await downloadFrom(url, filename);
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setPending(null);
        }
    };
    const button = (key: string, url: string, filename: string) => (
        <Button type="button" variant="outline" size="sm" disabled={pending !== null} onClick={() => run(key, url, filename)}>
            <DownloadIcon className="mr-1.5 size-4" />
            {pending === key ? "Exporting…" : "Download"}
        </Button>
    );

    return (
        <div className="space-y-5">
            <div>
                <h3 className="font-bold">Export</h3>
                <p className="text-sm text-muted-foreground">Download this workspace&apos;s data.</p>
            </div>
            <div className="space-y-3">
                <Item title="Tasks (CSV)" description="Every task, for spreadsheets.">
                    {button("csv", `/api/export/tasks?workspaceId=${workspaceId}&format=csv`, "tasks.csv")}
                </Item>
                <Item title="Calendar (.ics)" description="Every scheduled task, for Google, Apple or Outlook Calendar.">
                    {button("ics", `/api/export/tasks?workspaceId=${workspaceId}&format=ics`, "calendar.ics")}
                </Item>
                {isAdmin && (
                    <>
                        <Item title="Bulk-input script" description="Projects, placeholders, tasks, routines and days off as commands; paste into Bulk setup to rebuild the workspace elsewhere.">
                            {button("script", `/api/export/workspaces/${workspaceId}/bulk-script`, "workspace-bulk-input.txt")}
                        </Item>
                        <Item title="Full backup (JSON)" description="Settings, members, projects, tasks, routines, holidays and change requests.">
                            <div className="flex items-center gap-2">
                                <Checkbox id="backup-emails" checked={withEmails} onCheckedChange={(checked) => setWithEmails(checked === true)} />
                                <Label htmlFor="backup-emails" className="text-sm font-normal">Include emails</Label>
                            </div>
                            {button("backup", `/api/export/workspaces/${workspaceId}/backup?emails=${withEmails}`, "workspace-backup.json")}
                        </Item>
                    </>
                )}
            </div>
        </div>
    );
};
