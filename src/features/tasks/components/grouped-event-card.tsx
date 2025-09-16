"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { Task, TaskStatus } from "../types";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface GroupedEventCardProps {
    tasks: Task[];
    date: Date;
    onMultipleTasksClick?: (tasks: Task[], date: Date, event: React.MouseEvent) => void;
}


const statusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "border-l-slate-500 bg-slate-100/80 dark:bg-slate-900/20",
    [TaskStatus.TODO]: "border-l-red-500 bg-red-100/80 dark:bg-red-950/20",
    [TaskStatus.IN_PROGRESS]: "border-l-amber-500 bg-amber-100/80 dark:bg-amber-950/20",
    [TaskStatus.IN_REVIEW]: "border-l-blue-600 bg-blue-100/80 dark:bg-blue-950/20",
    [TaskStatus.DONE]: "border-l-emerald-600 bg-emerald-100/80 dark:bg-emerald-950/20",
};

const statusIconMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "📋",
    [TaskStatus.TODO]: "📝",
    [TaskStatus.IN_PROGRESS]: "⚡",
    [TaskStatus.IN_REVIEW]: "👀",
    [TaskStatus.DONE]: "✅",
};

const statusColorClasses: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "text-black bg-slate-100 dark:bg-slate-800 dark:text-black",
    [TaskStatus.TODO]: "text-black bg-red-100 dark:bg-red-900 dark:text-black",
    [TaskStatus.IN_PROGRESS]: "text-black bg-amber-100 dark:bg-amber-900 dark:text-black",
    [TaskStatus.IN_REVIEW]: "text-black bg-blue-100 dark:bg-blue-900 dark:text-black",
    [TaskStatus.DONE]: "text-black bg-emerald-100 dark:bg-emerald-900 dark:text-black",
};

export const GroupedEventCard = ({ tasks, date, onMultipleTasksClick }: GroupedEventCardProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const router = useRouter();
    const workspaceId = useWorkspaceId();

    // Handle edge cases
    if (!tasks || tasks.length === 0) {
        return null;
    }

    // Group tasks by project first, then by status
    const groupedTasks = tasks.reduce((groups, task) => {
        const projectKey = task.project?.name || "No Project";
        const statusKey = task.status;
        
        if (!groups[projectKey]) {
            groups[projectKey] = {} as Record<TaskStatus, Task[]>;
        }
        if (!groups[projectKey][statusKey]) {
            groups[projectKey][statusKey] = [];
        }
        groups[projectKey][statusKey].push(task);
        return groups;
    }, {} as Record<string, Record<TaskStatus, Task[]>>);

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupKey)) {
                newSet.delete(groupKey);
            } else {
                newSet.add(groupKey);
            }
            return newSet;
        });
    };

    const handleTaskClick = (taskId: string) => {
        if (taskId && workspaceId) {
            router.push(`/workspaces/${workspaceId}/tasks/${taskId}`);
        }
    };

    const totalTasks = tasks.length;
    const projectCount = Object.keys(groupedTasks).length;

    return (
        <div className="px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1.5 lg:py-1.5">
            <div className="bg-card border border-border/50 rounded-lg border-l-4 border-l-blue-500 shadow-lg transition-all duration-300 hover:shadow-2xl backdrop-blur-sm hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5 hover:border-primary/30 hover:ring-2 hover:ring-primary/10 w-full max-w-full relative z-50">
                {/* Header with task count */}
                <div 
                    className="p-2 cursor-pointer hover:bg-muted/20 transition-unified"
                    onClick={(e) => {
                        if (onMultipleTasksClick) {
                            onMultipleTasksClick(tasks, date, e);
                        } else {
                            toggleGroup('all');
                        }
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1">
                                {expandedGroups.has('all') ? (
                                    <ChevronDownIcon className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                    <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className="text-xs font-semibold text-foreground">
                                    {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {projectCount} project{projectCount !== 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded content */}
                {expandedGroups.has('all') && (
                    <div className="border-t border-border/30 p-2 space-y-2">
                        {Object.entries(groupedTasks).map(([projectName, statusGroups]) => (
                            <div key={projectName} className="space-y-2">
                                {/* Project header */}
                                <div className="flex items-center gap-1.5 pb-1 border-b border-border/20">
                                    {projectName !== "No Project" ? (
                                        <>
                                            <ProjectAvatar
                                                name={projectName}
                                                className="size-4"
                                            />
                                            <span className="text-xs font-medium text-foreground">
                                                {projectName}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="size-4 rounded-md bg-muted flex items-center justify-center">
                                                <span className="text-xs text-muted-foreground">?</span>
                                            </div>
                                            <span className="text-xs font-medium text-muted-foreground">
                                                No Project
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Status groups */}
                                {Object.entries(statusGroups).map(([status, statusTasks]) => (
                                    <div key={`${projectName}-${status}`} className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs opacity-70">
                                                {statusIconMap[status as TaskStatus]}
                                            </span>
                                            <span className={cn(
                                                "text-xs px-2 py-0.5 rounded-full font-medium",
                                                statusColorClasses[status as TaskStatus]
                                            )}>
                                                {status.replace('_', ' ')} ({statusTasks.length})
                                            </span>
                                        </div>

                                        {/* Tasks in this status */}
                                        <div className="ml-4 space-y-1">
                                            {statusTasks.map((task) => (
                                                <div
                                                    key={task.$id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleTaskClick(task.$id);
                                                    }}
                                                    className={cn(
                                                        "p-2 text-xs bg-card text-foreground border border-border/50 rounded-unified-sm border-l-4 flex flex-col gap-y-1 cursor-pointer hover:shadow-unified-md hover:scale-[1.01] transition-unified group",
                                                        statusColorMap[task.status]
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-1">
                                                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-unified text-xs leading-tight">
                                                            {task.name}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-x-1.5">
                                                        {task.assignee ? (
                                                            <div className="flex items-center gap-1">
                                                                <MemberAvatar
                                                                    name={task.assignee.name}
                                                                    className="size-3"
                                                                />
                                                                <span className="text-xs text-muted-foreground truncate max-w-[60px]">
                                                                    {task.assignee.name}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <div className="size-3 rounded-md bg-muted flex items-center justify-center">
                                                                    <span className="text-xs text-muted-foreground">?</span>
                                                                </div>
                                                                <span className="text-xs text-muted-foreground">Unassigned</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
