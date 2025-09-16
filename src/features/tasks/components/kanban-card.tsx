import { MoreHorizontal } from "lucide-react";
import { Task, TaskStatus } from "../types";
import { TaskActions } from "./task-actions";
import { DottedSeparator } from "@/components/dotted-separator";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { TaskDate } from "./task-date";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { cn } from "@/lib/utils";

interface KanbanCardProps {
    task: Task;
}

const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "border-l-slate-500 bg-slate-100/60 dark:bg-slate-900/10",
    [TaskStatus.TODO]: "border-l-red-500 bg-red-100/60 dark:bg-red-950/10",
    [TaskStatus.IN_PROGRESS]: "border-l-amber-500 bg-amber-100/60 dark:bg-amber-950/10",
    [TaskStatus.IN_REVIEW]: "border-l-blue-600 bg-blue-100/60 dark:bg-blue-950/10",
    [TaskStatus.DONE]: "border-l-emerald-600 bg-emerald-100/60 dark:bg-emerald-950/10",
};

export const KanbanCard = ({ task }: KanbanCardProps) => {
    return (
        <div className={cn(
            "bg-card p-2.5 mb-1.5 rounded-unified shadow-unified space-unified-sm border border-border transition-unified hover:shadow-unified-md border-l-4",
            statusColorMap[task.status]
        )}>
            <div className="flex items-start justify-between gap-x-2">
                <p className="text-sm line-clamp-2 text-foreground">{task.name}</p>
                <TaskActions id={task.$id} projectId={task.projectId}> 
                    <MoreHorizontal className="size-[18px] stroke-1 shrink-0 text-muted-foreground hover:text-foreground transition-unified" />
                </TaskActions>
            </div>
            <DottedSeparator />
            <div className="flex items-center gap-x-1.5">
                {task.assignee ? (
                    <MemberAvatar
                        name={task.assignee.name}
                        fallbackClassName="text-[10px]"
                    />
                ) : (
                    <div className="size-6 rounded-md bg-muted flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">?</span>
                    </div>
                )}
                <div className="size-1 rounded-full bg-border" />
                <TaskDate value={task.dueDate} className="text-xs" />
            </div>

            <div className="flex items-center gap-x-1.5">
                {task.project ? (
                    <>
                        <ProjectAvatar
                            name={task.project.name} 
                            fallbackClassName="text-[10px]"
                        /> 
                        <span className="text-xs font-medium text-muted-foreground">{task.project.name}</span>
                    </>
                ) : (
                    <span className="text-xs font-medium text-muted-foreground">No project</span>
                )}
            </div>
        </div>        
    );
};