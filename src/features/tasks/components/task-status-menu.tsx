"use client";

import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { snakeCaseToTitleCase } from "@/lib/utils";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { canSetStatus } from "@/features/members/permissions";

import { useUpdateTask } from "../api/use-update-task";
import { Task, TaskStatus } from "../types";

const STATUSES = Object.values(TaskStatus);

// Status badge doubles as a menu to change status in place. Only the moves this person's role
// allows are offered; with none, it's a plain badge.
export const TaskStatusMenu = ({ task, align = "start" }: { task: Task; align?: "start" | "end" }) => {
    const { mutate } = useUpdateTask();
    const { role, memberId } = usePermissions({ workspaceId: task.workspaceId });
    const isAssignee = Boolean(memberId && task.assigneeIds?.includes(memberId));
    const allowed = (to: TaskStatus) => canSetStatus(role, { isAssignee, from: task.status, to });
    const badge = <Badge variant={task.status}>{snakeCaseToTitleCase(task.status)}</Badge>;

    if (!STATUSES.some((status) => status !== task.status && allowed(status))) {
        return <span className="shrink-0">{badge}</span>;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Change status of ${task.name} (${snakeCaseToTitleCase(task.status)})`}
                    className="shrink-0 cursor-pointer rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-0 min-w-0"
                >
                    {badge}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={align}>
                {STATUSES.filter((status) => status === task.status || allowed(status)).map((status) => (
                    <DropdownMenuItem
                        key={status}
                        disabled={status === task.status}
                        onClick={() => mutate({ param: { taskId: task.$id }, json: { status } })}
                    >
                        <Badge variant={status}>{snakeCaseToTitleCase(status)}</Badge>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};
