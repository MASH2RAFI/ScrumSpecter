"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { XIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { MemberAvatarStack } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import { Task, TaskStatus } from "../types";
import { useDismiss } from "../hooks/use-dismiss";
import { useTaskPanel } from "../hooks/use-task-panel";
import {
    NO_PROJECT,
    calendarStatusColorMap,
    calendarStatusIconMap,
    groupTasksByProjectAndStatus,
    pluralize,
} from "./calendar-utils";

interface MultipleTasksPopupProps {
    tasks: Task[];
    date: Date;
    isOpen: boolean;
    onClose: () => void;
    position: { x: number; y: number };
}

const statusBadgeColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "text-black bg-slate-100 dark:bg-slate-900 dark:text-black",
    [TaskStatus.TODO]: "text-black bg-red-100 dark:bg-red-900 dark:text-black",
    [TaskStatus.IN_PROGRESS]: "text-black bg-amber-100 dark:bg-amber-900 dark:text-black",
    [TaskStatus.IN_REVIEW]: "text-black bg-blue-100 dark:bg-blue-900 dark:text-black",
    [TaskStatus.DONE]: "text-black bg-emerald-100 dark:bg-emerald-900 dark:text-black",
};

export const MultipleTasksPopup = ({ tasks, date, isOpen, onClose, position }: MultipleTasksPopupProps) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const popupRef = useRef<HTMLDivElement>(null);
    const { open: openTask } = useTaskPanel();

    useDismiss(popupRef, isOpen, onClose);

    if (!isOpen) {
        return null;
    }

    const handleTaskClick = (taskId: string) => {
        if (taskId) {
            openTask(taskId);
            onClose();
        }
    };

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (!next.delete(groupKey)) {
                next.add(groupKey);
            }
            return next;
        });
    };

    const groupedTasks = groupTasksByProjectAndStatus(tasks);
    const projectCount = Object.keys(groupedTasks).length;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

    return (
        <div
            ref={popupRef}
            role="dialog"
            aria-label={`Tasks on ${format(date, "MMMM d, yyyy")}`}
            className={cn(
                "fixed z-50 bg-card border border-border rounded-lg shadow-xl backdrop-blur-sm",
                isMobile ? "mobile-popup" : ""
            )}
            style={isMobile ? {} : {
                left: position.x,
                top: position.y,
                maxWidth: "500px",
                minWidth: "350px",
                maxHeight: "500px",
                overflowY: "auto",
            }}
        >
            <div className="p-4 border-b border-border bg-muted/20">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-foreground">
                            {format(date, "MMMM d, yyyy")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {pluralize(tasks.length, "task")} across {pluralize(projectCount, "project")}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="p-1 hover:bg-muted rounded-md transition-colors"
                    >
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {Object.entries(groupedTasks).map(([projectName, statusGroups]) => (
                    <div key={projectName} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2 border-b border-border/20">
                            {projectName !== NO_PROJECT ? (
                                <>
                                    <ProjectAvatar name={projectName} className="size-5" />
                                    <span className="font-medium text-foreground">
                                        {projectName}
                                    </span>
                                </>
                            ) : (
                                <span className="font-medium text-muted-foreground">
                                    {NO_PROJECT}
                                </span>
                            )}
                        </div>

                        {Object.entries(statusGroups).map(([status, statusTasks]) => {
                            const groupKey = `${projectName}-${status}`;
                            const isExpanded = expandedGroups.has(groupKey);
                            return (
                                <div key={groupKey} className="space-y-2">
                                    <div
                                        className="flex items-center gap-2 cursor-pointer hover:bg-muted/20 p-2 rounded-md transition-colors"
                                        onClick={() => toggleGroup(groupKey)}
                                    >
                                        <div className="flex items-center gap-2">
                                            {isExpanded ? (
                                                <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                                <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span className="text-sm opacity-70">
                                                {calendarStatusIconMap[status as TaskStatus]}
                                            </span>
                                            <span className={cn(
                                                "text-sm px-2 py-1 rounded-full font-medium",
                                                statusBadgeColorMap[status as TaskStatus]
                                            )}>
                                                {status} ({statusTasks.length})
                                            </span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="ml-6 space-y-2">
                                            {statusTasks.map((task) => (
                                                <div
                                                    key={task.$id}
                                                    onClick={() => handleTaskClick(task.$id)}
                                                    className={cn(
                                                        "p-3 rounded-lg border border-border/50 border-l-4 cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all duration-200 group min-h-[44px] flex items-center",
                                                        "touch-manipulation",
                                                        calendarStatusColorMap[task.status]
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                                            {task.name}
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-sm">
                                                        {task.assignees?.length ? (
                                                            <div className="flex items-center gap-1">
                                                                <MemberAvatarStack names={task.assignees.map((a) => a.name)} max={2} className="size-4" />
                                                                <span className="text-muted-foreground truncate max-w-[100px]">
                                                                    {task.assignees.map((a) => a.name).join(", ")}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1">
                                                                <div className="size-4 rounded-md bg-muted flex items-center justify-center">
                                                                    <span className="text-xs text-muted-foreground">?</span>
                                                                </div>
                                                                <span className="text-muted-foreground">Unassigned</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
};
