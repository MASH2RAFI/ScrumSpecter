import { MoreHorizontal } from "lucide-react";
import { Task, TaskStatus } from "../types";
import { TaskActions } from "./task-actions";
import { DottedSeparator } from "@/components/dotted-separator";
import { MemberAvatarStack } from "@/features/members/components/member-avatar";
import { TaskDate } from "./task-date";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { cn } from "@/lib/utils";
import { useTaskPanel } from "../hooks/use-task-panel";

interface KanbanCardProps {
    task: Task;
}

const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "border-l-rose-400",
    [TaskStatus.TODO]: "border-l-slate-400",
    [TaskStatus.IN_PROGRESS]: "border-l-amber-500",
    [TaskStatus.IN_REVIEW]: "border-l-sky-500",
    [TaskStatus.DONE]: "border-l-emerald-600",
};

export const KanbanCard = ({ task }: KanbanCardProps) => {
    const { open } = useTaskPanel();

    return (
        // @hello-pangea/dnd swallows the click that ends a drag, so this only fires on a real click
        <div onClick={() => open(task.$id)} className={cn(
            "cursor-pointer",
            "bg-card p-2 sm:p-2.5 mb-1 sm:mb-1.5 rounded-xl shadow-soft space-unified-sm border border-border/70 transition-[box-shadow,transform] duration-300 ease-out hover:shadow-lift hover:-translate-y-0.5 border-l-4 touch-manipulation",
            statusColorMap[task.status]
        )}>
            <div className="flex items-start justify-between gap-x-1 sm:gap-x-2">
                <p className="text-xs sm:text-sm line-clamp-2 text-foreground flex-1 min-w-0">{task.name}</p>
                {/* The menu handles its own clicks; don't also open the panel */}
                <div onClick={(e) => e.stopPropagation()}>
                <TaskActions id={task.$id} projectId={task.projectId}>
                    <MoreHorizontal className="size-4 sm:size-[18px] stroke-1 shrink-0 text-muted-foreground hover:text-foreground transition-unified min-h-[44px] sm:min-h-[32px] min-w-[44px] sm:min-w-[32px] flex items-center justify-center" />
                </TaskActions>
                </div>
            </div>
            <DottedSeparator />
            <div className="flex items-center gap-x-1 sm:gap-x-1.5">
                {task.assignees?.length ? (
                    <MemberAvatarStack
                        names={task.assignees.map((assignee) => assignee.name)}
                        fallbackClassName="text-[8px] sm:text-[10px]"
                        className="size-5 sm:size-6"
                    />
                ) : (
                    <div className="size-5 sm:size-6 rounded-md bg-muted flex items-center justify-center">
                        <span className="text-[8px] sm:text-[10px] text-muted-foreground">?</span>
                    </div>
                )}
                <div className="size-1 rounded-full bg-border" />
                <TaskDate value={task.dueDate} startAt={task.startAt} durationMinutes={task.durationMinutes} className="text-[10px] sm:text-xs" />
            </div>

            <div className="flex items-center gap-x-1 sm:gap-x-1.5">
                {task.project ? (
                    <>
                        <ProjectAvatar
                            name={task.project.name} 
                            fallbackClassName="text-[8px] sm:text-[10px]"
                            className="size-5 sm:size-6"
                        /> 
                        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{task.project.name}</span>
                    </>
                ) : (
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">No project</span>
                )}
            </div>
        </div>        
    );
};