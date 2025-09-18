"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { Task, TaskStatus } from "../types";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { XIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface MultipleTasksPopupProps {
  tasks: Task[];
  date: Date;
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
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

const statusBadgeColorMap: Record<TaskStatus, string> = {
  [TaskStatus.BACKLOG]: "text-black bg-slate-100 dark:bg-slate-900 dark:text-black",
  [TaskStatus.TODO]: "text-black bg-red-100 dark:bg-red-900 dark:text-black",
  [TaskStatus.IN_PROGRESS]: "text-black bg-amber-100 dark:bg-amber-900 dark:text-black",
  [TaskStatus.IN_REVIEW]: "text-black bg-blue-100 dark:bg-blue-900 dark:text-black",
  [TaskStatus.DONE]: "text-black bg-emerald-100 dark:bg-emerald-900 dark:text-black",
};

export const MultipleTasksPopup = ({ tasks, date, isOpen, onClose, position }: MultipleTasksPopupProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleTaskClick = (taskId: string) => {
    if (taskId && workspaceId) {
      router.push(`/workspaces/${workspaceId}/tasks/${taskId}`);
      onClose();
    }
  };

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

  if (!isOpen || !isVisible) {
    return null;
  }

  const totalTasks = tasks.length;
  const projectCount = Object.keys(groupedTasks).length;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        "fixed z-50 bg-card border border-border rounded-lg shadow-xl backdrop-blur-sm",
        typeof window !== 'undefined' && window.innerWidth < 640 ? "mobile-popup" : ""
      )}
      style={typeof window !== 'undefined' && window.innerWidth < 640 ? {} : {
        left: position.x,
        top: position.y,
        maxWidth: '500px',
        minWidth: '350px',
        maxHeight: '500px',
        overflowY: 'auto'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">
              {format(date, 'MMMM d, yyyy')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {totalTasks} task{totalTasks !== 1 ? 's' : ''} across {projectCount} project{projectCount !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="p-4 space-y-4">
        {Object.entries(groupedTasks).map(([projectName, statusGroups]) => (
          <div key={projectName} className="space-y-3">
            {/* Project header */}
            <div className="flex items-center gap-2 pb-2 border-b border-border/20">
              {projectName !== "No Project" ? (
                <>
                  <ProjectAvatar
                    name={projectName}
                    className="size-5"
                  />
                  <span className="font-medium text-foreground">
                    {projectName}
                  </span>
                </>
              ) : (
                <span className="font-medium text-muted-foreground">
                  No Project
                </span>
              )}
            </div>

            {/* Status groups */}
            {Object.entries(statusGroups).map(([status, statusTasks]) => (
              <div key={`${projectName}-${status}`} className="space-y-2">
                <div 
                  className="flex items-center gap-2 cursor-pointer hover:bg-muted/20 p-2 rounded-md transition-colors"
                  onClick={() => toggleGroup(`${projectName}-${status}`)}
                >
                  <div className="flex items-center gap-2">
                    {expandedGroups.has(`${projectName}-${status}`) ? (
                      <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm opacity-70">
                      {statusIconMap[status as TaskStatus]}
                    </span>
                    <span className={cn(
                      "text-sm px-2 py-1 rounded-full font-medium",
                      statusBadgeColorMap[status as TaskStatus]
                    )}>
                      {status} ({statusTasks.length})
                    </span>
                  </div>
                </div>

                {/* Tasks in this status */}
                {expandedGroups.has(`${projectName}-${status}`) && (
                  <div className="ml-6 space-y-2">
                    {statusTasks.map((task) => (
                      <div
                        key={task.$id}
                        onClick={() => handleTaskClick(task.$id)}
                        className={cn(
                          "p-3 rounded-lg border border-border/50 border-l-4 cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-95 transition-all duration-200 group min-h-[44px] flex items-center",
                          "touch-manipulation", // Optimize for touch
                          statusColorMap[task.status]
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {task.name}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-3 text-sm">
                          {task.assignee ? (
                            <div className="flex items-center gap-1">
                              <MemberAvatar
                                name={task.assignee.name}
                                className="size-4"
                              />
                              <span className="text-muted-foreground truncate max-w-[100px]">
                                {task.assignee.name}
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
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
