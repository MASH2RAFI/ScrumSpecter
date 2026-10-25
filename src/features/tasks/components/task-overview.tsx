import { Button } from "@/components/ui/button";
import { Task, TaskStatus } from "../types";
import Link from "next/link";
import { ClockIcon, PencilIcon, RepeatIcon, TargetIcon } from "lucide-react";
import { DEFAULT_DURATION_MINUTES, formatDuration, formatTimeRange } from "../task-time";
import { DottedSeparator } from "@/components/dotted-separator";
import { OverviewProperty } from "./overview-property";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { TaskDate } from "./task-date";
import { snakeCaseToTitleCase, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useEditTaskModal } from "../hooks/use-edit-task-modal";

interface TaskOverviewProps { 
    task: Task;
};

const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG] : "bg-slate-200 text-black dark:bg-slate-800 dark:text-slate-100",
    [TaskStatus.TODO]: "bg-red-200 text-black dark:bg-red-900 dark:text-red-100",
    [TaskStatus.IN_PROGRESS]: "bg-amber-200 text-black dark:bg-amber-900 dark:text-amber-100",
    [TaskStatus.IN_REVIEW]: "bg-blue-200 text-black dark:bg-blue-900 dark:text-blue-100",
    [TaskStatus.DONE]: "bg-emerald-200 text-black dark:bg-emerald-900 dark:text-emerald-100",
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
                    {task.project && (
                        <OverviewProperty label="Project">
                            <Link
                                href={`/workspaces/${task.workspaceId}/projects/${task.projectId}`}
                                className="flex items-center gap-x-2 hover:underline"
                            >
                                <ProjectAvatar name={task.project.name} className="size-6" />
                                <p className="text-sm font-medium">{task.project.name}</p>
                            </Link>
                        </OverviewProperty>
                    )}
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
                    {task.startAt && (
                        <OverviewProperty label="Time">
                            <ClockIcon className="size-4 text-muted-foreground" />
                            <p className="text-sm font-medium">
                                {formatTimeRange(task.startAt, task.durationMinutes)}
                                <span className="ml-1.5 text-muted-foreground font-normal">{formatDuration(task.durationMinutes ?? DEFAULT_DURATION_MINUTES)}</span>
                            </p>
                        </OverviewProperty>
                    )}
                    <OverviewProperty label="Status">
                        <Badge className={cn(statusColorMap[task.status])}>
                            {snakeCaseToTitleCase(task.status)}
                        </Badge>
                    </OverviewProperty>
                    <OverviewProperty label="Story Points">
                        <TargetIcon className="size-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{task.storyPoints ?? "Not set"}</p>
                    </OverviewProperty>
                    {task.routineId && (
                        <OverviewProperty label="Repeats">
                            <RepeatIcon className="size-4 text-primary" />
                            <p className="text-sm font-medium">Weekly routine</p>
                        </OverviewProperty>
                    )}
                </div>
            </div> 

        </div> 
    );
};