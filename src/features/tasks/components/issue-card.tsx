import { RepeatIcon } from "lucide-react";

import { cn, snakeCaseToTitleCase } from "@/lib/utils";
import { MemberAvatarStack } from "@/features/members/components/member-avatar";

import { Task, TaskStatus } from "../types";
import { formatTime, formatTimeRange } from "../task-time";

export const TASK_DRAG_TYPE = "application/x-scrumspecter-task";

// Status as a left bar, like Jira's issue cards
const statusBar: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "border-l-slate-400",
    [TaskStatus.TODO]: "border-l-red-500",
    [TaskStatus.IN_PROGRESS]: "border-l-amber-500",
    [TaskStatus.IN_REVIEW]: "border-l-blue-600",
    [TaskStatus.DONE]: "border-l-emerald-600",
};

// "WEB" for "Website": a short, stable label standing in for an issue key
export const projectKey = (name?: string | null) =>
    (name ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "—";

interface IssueCardProps {
    task: Task;
    // month: one line; allday: a narrow week/day all-day cell;
    // block: fills a week/day time block; panel: the unscheduled list
    variant: "month" | "allday" | "block" | "panel";
    // A time block too short for the full layout
    compact?: boolean;
    draggable?: boolean;
    onDragStart?: (task: Task) => void;
    onDragEnd?: () => void;
    onOpen?: (taskId: string) => void;
}

export const IssueCard = ({ task, variant, compact, draggable, onDragStart, onDragEnd, onOpen }: IssueCardProps) => {
    const done = task.status === TaskStatus.DONE;
    const meta = (
        <span className="flex items-center gap-1 shrink-0">
            {task.storyPoints != null && (
                <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground" title={`${task.storyPoints} story points`}>
                    {task.storyPoints}
                </span>
            )}
            {task.assignees?.length ? <MemberAvatarStack names={task.assignees.map((a) => a.name)} max={2} className="size-4" fallbackClassName="text-[9px]" /> : null}
        </span>
    );

    return (
        <div
            role="button"
            tabIndex={0}
            data-task-id={task.$id}
            draggable={draggable}
            onDragStart={draggable ? (e) => {
                e.stopPropagation();
                e.dataTransfer.setData(TASK_DRAG_TYPE, task.$id);
                e.dataTransfer.effectAllowed = "move";
                onDragStart?.(task);
            } : undefined}
            onDragEnd={onDragEnd}
            onClick={onOpen ? (e) => {
                e.stopPropagation();
                onOpen(task.$id);
            } : undefined}
            onKeyDown={onOpen ? (e) => {
                if (e.key === "Enter") onOpen(task.$id);
            } : undefined}
            title={`${task.name} · ${snakeCaseToTitleCase(task.status)}${task.project ? ` · ${task.project.name}` : ""}`}
            className={cn(
                // min-h-0 overrides the global 44px touch-target rule for [role=button]
                "issue-card w-full min-w-0 min-h-0 overflow-hidden rounded border border-border/70 border-l-[3px] bg-card text-card-foreground text-left",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                onOpen && "cursor-pointer",
                draggable && "cursor-grab active:cursor-grabbing",
                statusBar[task.status],
                variant === "block" && "h-full",
                variant === "panel" && "shadow-sm",
            )}
        >
            {variant === "month" || (variant === "block" && compact) ? (
                // One line: month cells and short time blocks are too small for more
                <div className="flex items-center gap-1 px-1.5 py-[3px] text-xs leading-tight">
                    {task.routineId && <RepeatIcon className="size-3 shrink-0 text-primary" aria-label="Routine" />}
                    {task.startAt && (
                        <span className="shrink-0 text-muted-foreground">
                            {variant === "month" ? formatTimeRange(task.startAt, task.durationMinutes) : formatTime(task.startAt)}
                        </span>
                    )}
                    <span className={cn("min-w-0 truncate flex-1 font-medium", done && "line-through text-muted-foreground")}>{task.name}</span>
                    {task.storyPoints != null && <span className="shrink-0 text-[10px] text-muted-foreground">{task.storyPoints}</span>}
                </div>
            ) : variant === "allday" ? (
                // Narrow cells: the name gets the room
                <div className="flex items-center gap-1 px-1.5 py-[3px] text-xs leading-tight">
                    {task.routineId && <RepeatIcon className="size-3 shrink-0 text-primary" aria-label="Routine" />}
                    <span className={cn("min-w-0 truncate flex-1 font-medium", done && "line-through text-muted-foreground")}>{task.name}</span>
                    {task.storyPoints != null && <span className="shrink-0 text-[10px] text-muted-foreground">{task.storyPoints}</span>}
                </div>
            ) : (
                <div className="flex h-full flex-col gap-0.5 px-1.5 py-1 text-xs leading-tight">
                    <span className={cn("line-clamp-2 font-semibold", done && "line-through text-muted-foreground")}>
                        {task.routineId && <RepeatIcon className="mr-1 inline size-3 -mt-0.5 text-primary" aria-label="Routine" />}
                        {task.name}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">
                        {task.startAt ? formatTimeRange(task.startAt, task.durationMinutes) : variant === "panel" ? task.project?.name : "All day"}
                    </span>
                    <div className="mt-auto flex items-center justify-between gap-1">
                        <span className="rounded bg-muted px-1 text-[10px] font-semibold text-muted-foreground">{projectKey(task.project?.name)}</span>
                        {meta}
                    </div>
                </div>
            )}
        </div>
    );
};
