import {
    CircleCheckIcon,
    CircleDashedIcon,
    CircleDotDashedIcon,
    CircleDotIcon,
    CircleIcon,
    PlusIcon,
} from "lucide-react";

import { snakeCaseToTitleCase } from "@/lib/utils";
import { TaskStatus } from "../types";
import { Button } from "@/components/ui/button";
import { useCreateTaskModal } from "../hooks/use-create-task-modal";
import { usePermissions } from "@/features/members/hooks/use-permissions";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";

interface KanbanColumnHeaderProps {
    board: TaskStatus;
    taskCount: number;
    storyPoints: number;
};

const statusIconMap: Record<TaskStatus, React.ReactNode> = {
    [TaskStatus.BACKLOG] : (
        <CircleDashedIcon className="size-4 sm:size-[18px] text-pink-400" />
    ),
    [TaskStatus.TODO]: (
        <CircleIcon className="size-4 sm:size-[18px] text-red-400" />
    ),
    [TaskStatus.IN_PROGRESS] : (
        <CircleDotDashedIcon className="size-4 sm:size-[18px] text-yellow-400" />
    ),
    [TaskStatus.IN_REVIEW] : (
        <CircleDotIcon className="size-4 sm:size-[18px] text-primary" />
    ),
    [TaskStatus.DONE] : (
        <CircleCheckIcon className="size-4 sm:size-[18px] text-emerald-400" />
    ),
}

export const KanbanColumnHeader = ({
    board,
    taskCount,
    storyPoints,
}: KanbanColumnHeaderProps) => {
    const { open } = useCreateTaskModal();
    const workspaceId = useWorkspaceId();
    const { canEditWork } = usePermissions({ workspaceId });
    const icon = statusIconMap [ board ]
    return (
        <div className="px-1 sm:px-2 py-1 sm:py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-x-1 sm:gap-x-2 min-w-0 flex-1">
                {icon}
                <h2 className="text-xs sm:text-sm font-medium text-foreground truncate">
                    {snakeCaseToTitleCase(board)}
                </h2>
                <div className="size-4 sm:size-5 flex items-center justify-center rounded-md bg-muted text-[10px] sm:text-xs text-muted-foreground font-medium flex-shrink-0"> 
                 {taskCount} 
                </div>
                {storyPoints > 0 && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0" title="Story points in this column">
                        {storyPoints} pts
                    </span>
                )}
            </div>

            {canEditWork && (
                <Button 
                    onClick={() => open(board)} 
                    variant="ghost" 
                    size="icon" 
                    className="size-6 sm:size-5 min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] flex-shrink-0"
                >
                    <PlusIcon className="size-3 sm:size-4 text-muted-foreground" />
                </Button>
            )}

        </div>
    );
};

// Bottom-of-column shortcut to create a task already in this status (admins and supervisors)
export const KanbanQuickAdd = ({ board }: { board: TaskStatus }) => {
    const { open } = useCreateTaskModal();
    const workspaceId = useWorkspaceId();
    const { canEditWork } = usePermissions({ workspaceId });

    if (!canEditWork) {
        return null;
    }

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => open(board)}
            className="w-full justify-start gap-1.5 text-muted-foreground hover:text-foreground"
        >
            <PlusIcon className="size-4" />
            Add task
        </Button>
    );
};
