import { Button } from "@/components/ui/button";
import { Task, TaskStatus } from "../types";
import { PencilIcon } from "lucide-react";
import { DottedSeparator } from "@/components/dotted-separator";
import { OverviewProperty } from "./overview-property";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { TaskDate } from "./task-date";
import { snakeCaseToTitleCase, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useEditTaskModal } from "../hooks/use-edit-task-modal";

interface TaskOverviewProps { 
    task: Task;
};

const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "bg-slate-200 text-black dark:bg-slate-800 dark:text-black",
    [TaskStatus.TODO]: "bg-red-200 text-black dark:bg-red-900 dark:text-black",
    [TaskStatus.IN_PROGRESS]: "bg-amber-200 text-black dark:bg-amber-900 dark:text-black",
    [TaskStatus.IN_REVIEW]: "bg-blue-200 text-black dark:bg-blue-900 dark:text-black",
    [TaskStatus.DONE]: "bg-emerald-200 text-black dark:bg-emerald-900 dark:text-black",
};

export const TaskOverview = ({ 
    task
}: TaskOverviewProps) => { 
    const { open } = useEditTaskModal();
    return ( 
        <div className="flex flex-col gap-y-4 col-span-1">
            <div className="bg-muted rounded-lg p-4"> 
                <div className="flex items-center justify-between"> 
                    <p className="text-lg font-semibold">Overview</p>
                    <Button onClick={() => open(task.$id)} size="sm" variant="secondary"> 
                        <PencilIcon className="size-4 mr-2" />
                        Edit 
                    </Button> 
                </div> 
                <DottedSeparator className="my-4" />
                <div className="flex flex-col gap-y-4">
                    <OverviewProperty label="Assignee">
                        {task.assignee ? (
                            <>
                                <MemberAvatar
                                    name={task.assignee.name}
                                    className="size-6"
                                />
                                <p className="text-sm font-medium">{task.assignee.name}</p>
                            </>
                        ) : (
                            <p className="text-sm font-medium text-muted-foreground">Unassigned</p>
                        )}
                    </OverviewProperty>
                    <OverviewProperty label="Due Date">
                        <TaskDate value={task.dueDate} className="text-sm font-medium" />
                    </OverviewProperty>
                    <OverviewProperty label="Status"> 
                    <Badge className={cn(statusColorMap[task.status])}> 
                        {snakeCaseToTitleCase(task.status)}
                    </Badge> 
                    </OverviewProperty> 
                </div>
            </div> 

        </div> 
    );
};