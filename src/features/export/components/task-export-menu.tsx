"use client";

import { useState } from "react";
import { DownloadIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { downloadFrom, toQuery } from "../download";

export type ExportFilters = {
    workspaceId: string;
    projectId?: string | null;
    status?: string | null;
    assigneeId?: string | null;
    search?: string | null;
    from?: string;
    to?: string;
    excludeProjects?: string[];
    starred?: boolean;
    assignees?: string[];
    statuses?: string[];
    overdue?: boolean;
};

// The Tasks page's Export menu: the table's tasks (current filters) as CSV, and the calendar
// (the range on screen, or every scheduled task) as .ics
export const TaskExportMenu = ({ filters, week, calendarRange }: {
    filters: ExportFilters;
    week: { weekFrom: string; weekTo: string };
    // Set while the calendar is open
    calendarRange?: { from: string; to: string } | null;
}) => {
    const [pending, setPending] = useState(false);
    const { excludeProjects, from, to, starred, assignees, statuses, overdue, ...rest } = filters;
    const list = (values?: string[]) => (values?.length ? [...values].sort().join(",") : undefined);
    const common = {
        ...rest,
        excludeProjects: list(excludeProjects),
        assignees: list(assignees),
        statuses: list(statuses),
        starred: starred ? "true" : undefined,
        overdue: overdue ? "true" : undefined,
    };

    const run = async (query: Record<string, string | null | undefined>, filename: string) => {
        setPending(true);
        try {
            await downloadFrom(`/api/export/tasks?${toQuery(query)}`, filename);
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setPending(false);
        }
    };

    // A private link to "my tasks" for Google/Apple Calendar's "subscribe by URL"; reset makes old links stop working
    const subscribe = async (reset = false) => {
        setPending(true);
        try {
            const response = await fetch("/api/export/calendar-feed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId: filters.workspaceId, reset }),
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(body.error ?? "Couldn't make the calendar link");
            await navigator.clipboard.writeText(body.data.url);
            toast.success(reset
                ? "New calendar link copied. The old one no longer works."
                : "Calendar link copied. In Google or Apple Calendar, add a calendar \"From URL\" and paste it. Keep it private.");
        } catch (error) {
            toast.error((error as Error).message);
        } finally {
            setPending(false);
        }
    };

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 shrink-0 min-h-0 px-3" disabled={pending}>
                    <DownloadIcon className="size-4 sm:mr-1.5" />
                    <span className="sr-only sm:not-sr-only">Export</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => run({ ...common, from, to, ...week, scope: "table", format: "csv" }, "tasks.csv")}>
                    Tasks as CSV (current filters)
                </DropdownMenuItem>
                {calendarRange && (
                    <DropdownMenuItem onSelect={() => run({ ...common, ...calendarRange, scope: "calendar", format: "ics" }, "calendar.ics")}>
                        Calendar (.ics), dates on screen
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => run({ ...common, scope: "calendar", format: "ics" }, "calendar.ics")}>
                    Calendar (.ics), all scheduled tasks
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => subscribe()}>
                    Copy calendar subscribe link (my tasks)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => subscribe(true)}>
                    Reset calendar link
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
