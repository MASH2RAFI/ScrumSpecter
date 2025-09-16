import { TaskStatus, PopulatedAssignee, PopulatedProject } from "../types";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { useRouter } from "next/navigation";

interface EventCardProps{
    title: string;
    assignee: PopulatedAssignee | null;
    project: PopulatedProject | null;
    status: TaskStatus;
    id: string;
}

const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "border-l-slate-500 bg-slate-100/80 dark:bg-slate-900/20",
    [TaskStatus.TODO]: "border-l-red-500 bg-red-100/80 dark:bg-red-950/20",
    [TaskStatus.IN_PROGRESS]: "border-l-amber-500 bg-amber-100/80 dark:bg-amber-950/20",
    [TaskStatus.IN_REVIEW]: "border-l-blue-600 bg-blue-100/80 dark:bg-blue-950/20",
    [TaskStatus.DONE]: "border-l-emerald-600 bg-emerald-100/80 dark:bg-emerald-950/20",
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
        <div className="px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1.5 lg:py-1.5"> 
        <div onClick={onClick} className={cn(
            "p-1 sm:p-2 md:p-3 text-[8px] sm:text-[10px] md:text-xs lg:text-sm bg-card text-foreground border border-border/50 rounded-lg border-l-4 flex flex-col gap-y-0.5 sm:gap-y-1 md:gap-y-2 cursor-pointer hover:shadow-xl transition-all duration-300 group backdrop-blur-sm",
            "hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5",
            "hover:border-primary/30 hover:ring-2 hover:ring-primary/10",
            "w-full max-w-full relative z-50",
            statusColorMap[status]
        )}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs opacity-70 flex-shrink-0">{statusIconMap[status]}</span>
                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-unified text-xs leading-tight">{title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-x-1.5">
                    {assignee ? (
                        <div className="flex items-center gap-1">
                            <MemberAvatar
                                name={assignee.name}
                                className="size-4"
                            />
                            <span className="text-xs text-muted-foreground truncate max-w-[60px]">{assignee.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <div className="size-4 rounded-md bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">?</span>
                            </div>
                            <span className="text-xs text-muted-foreground">Unassigned</span>
                        </div>
                    )}
                    <div className="size-1 rounded-full bg-border/50" />
                    {project ? (
                        <div className="flex items-center gap-1">
                            <ProjectAvatar
                                name={project.name}
                                className="size-4"
                            />
                            <span className="text-xs text-muted-foreground truncate max-w-[60px]">{project.name}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1">
                            <div className="size-4 rounded-md bg-muted flex items-center justify-center">
                                <span className="text-xs text-muted-foreground">?</span>
                            </div>
                            <span className="text-xs text-muted-foreground">No project</span>
                        </div>
                    )}
                </div>
            </div> 
        </div> 
    ) 
}; 