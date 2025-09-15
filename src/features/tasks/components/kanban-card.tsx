import { MoreHorizontal } from "lucide-react";
import { Task } from "../types";
import { TaskActions } from "./task-actions";
import { DottedSeparator } from "@/components/dotted-separator";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { TaskDate } from "./task-date";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

interface KanbanCardProps {
    task: Task;
}

export const KanbanCard = ({ task }: KanbanCardProps) => {
    return (
        <div className="bg-card p-2.5 mb-1.5 rounded shadow-sm space-y-3 border border-border">
            <div className="flex items-start justify-between gap-x-2">
                <p className="text-sm line-clamp-2 text-foreground">{task.name}</p>
                <TaskActions id={task.$id} projectId={task.projectId}> 
                    <MoreHorizontal className="size-[18px] stroke-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors" />
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
                    <div className="size-6 rounded-full bg-muted flex items-center justify-center">
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