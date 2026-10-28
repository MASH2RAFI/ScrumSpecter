"use client";

import Link from "next/link";
import { AlertTriangleIcon, CheckCircle2Icon, CircleDotDashedIcon, ListTodoIcon, type LucideIcon } from "lucide-react";

import { CountUp, Lift, StaggerItem } from "@/components/motion";
import { cn } from "@/lib/utils";
import { TaskStatus } from "@/features/tasks/types";

type Stat = { label: string; value: number; hint: string; href: string; icon: LucideIcon; tone: string };

// Four headline numbers, each a way into the matching task list
// Counts come from the server (GET /api/tasks/summary), so they stay quick however many tasks
export type TaskCounts = { total: number; done: number; inProgress: number; inReview: number; overdue: number };

export const StatCards = ({ counts, workspaceId }: { counts: TaskCounts; workspaceId: string }) => {
    const base = `/workspaces/${workspaceId}/tasks`;
    const { total, done, inProgress, inReview, overdue } = counts;

    const stats: Stat[] = [
        { label: "All tasks", value: total, hint: `${total - done} still open`, href: base, icon: ListTodoIcon, tone: "bg-accent text-accent-foreground" },
        { label: "Done", value: done, hint: total ? `${Math.round((done / total) * 100)}% of all tasks` : "Nothing yet", href: `${base}?status=${TaskStatus.DONE}`, icon: CheckCircle2Icon, tone: "bg-primary text-primary-foreground" },
        { label: "In progress", value: inProgress, hint: inReview ? `${inReview} waiting for review` : "None waiting for review", href: `${base}?status=${TaskStatus.IN_PROGRESS}`, icon: CircleDotDashedIcon, tone: "bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300" },
        { label: "Overdue", value: overdue, hint: overdue ? "Past their end time" : "Nothing overdue", href: base, icon: AlertTriangleIcon, tone: overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground" },
    ];

    return (
        <>
            {stats.map(({ label, value, hint, href, icon: Icon, tone }) => (
                <StaggerItem key={label}>
                    <Lift className="h-full rounded-card">
                        <Link
                            href={href}
                            aria-label={`${label}: ${value}. ${hint}`}
                            className="flex h-full flex-col gap-4 rounded-card border border-border/70 bg-card p-5 shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span className="flex items-center justify-between">
                                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                                <span className={cn("grid size-9 place-items-center rounded-xl", tone)}>
                                    <Icon className="size-4" aria-hidden />
                                </span>
                            </span>
                            <CountUp value={value} className="text-4xl font-bold tracking-tight" />
                            <span className="text-xs text-muted-foreground">{hint}</span>
                        </Link>
                    </Lift>
                </StaggerItem>
            ))}
        </>
    );
};
