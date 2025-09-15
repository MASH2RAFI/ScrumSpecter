import { Project } from "@/features/projects/types";
import { TaskStatus } from "../types";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useRouter } from "next/navigation";

interface EventCardProps{
    title: string;
    assignee: {
        name: string;
        email: string;
        $id: string;
        $collectionId: string;
        $databaseId: string;
        $createdAt: string;
        $updatedAt: string;
        $permissions: string[];
        userId: string;
        workspaceId: string;
        role: string;
    } | null;
    project: {
        name: string;
        $id: string;
        $collectionId: string;
        $databaseId: string;
        $createdAt: string;
        $updatedAt: string;
        $permissions: string[];
        workspaceId: string;
        sprintDuration: number;
        sprintNumber: number;
        startingSprintDate: string;
        currentSprintStartDate: string;
        currentSprintEndDate: string;
    } | null;
    status: TaskStatus;
    id: string;
}

const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "border-l-pink-500 bg-pink-50/50 dark:bg-pink-950/20",
    [TaskStatus.TODO]: "border-l-red-500 bg-red-50/50 dark:bg-red-950/20",
    [TaskStatus.IN_PROGRESS]: "border-l-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20",
    [TaskStatus.IN_REVIEW]: "border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20",
    [TaskStatus.DONE]: "border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20",
};

const statusIconMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "📋",
    [TaskStatus.TODO]: "📝",
    [TaskStatus.IN_PROGRESS]: "⚡",
    [TaskStatus.IN_REVIEW]: "👀",
    [TaskStatus.DONE]: "✅",
};

export const EventCard = ({
    title, 
    assignee, 
    project, 
    status, 
    id, 
}: EventCardProps) => {
    const workspaceId = useWorkspaceId();
    const router = useRouter();
    const onClick = (
        e: React.MouseEvent<HTMLDivElement>
        ) => {
        e.stopPropagation();
        router.push(`/workspaces/${workspaceId}/tasks/${id}`)
};

    return ( 
        <div className="px-1 py-0.5"> 
            <div onClick={onClick} className={cn(
                "p-2 text-xs bg-card text-foreground border border-border/50 rounded-lg border-l-4 flex flex-col gap-y-2 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 group",
                statusColorMap[status]
            )}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs opacity-70 flex-shrink-0">{statusIconMap[status]}</span>
                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">{title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-x-1.5">
                    {assignee ? (
                        <div className="flex items-center gap-1">
                            <MemberAvatar
                                name={assignee.name}
                                className="size-4"
                            />
                            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{assignee.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <div className="size-4 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-[8px] text-muted-foreground">?</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">Unassigned</span>
                        </div>
                    )}
                    <div className="size-1 rounded-full bg-border/50" />
                    {project ? (
                        <div className="flex items-center gap-1">
                            <ProjectAvatar
                                name={project.name}
                                className="size-4"
                            />
                            <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">{project.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <div className="size-4 rounded-full bg-muted flex items-center justify-center">
                                <span className="text-[8px] text-muted-foreground">?</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">No project</span>
                        </div>
                    )}
                </div>
            </div> 
        </div> 
    ) 
}; 