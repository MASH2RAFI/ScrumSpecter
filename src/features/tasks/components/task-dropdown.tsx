"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { Task, TaskStatus } from "../types";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { XIcon } from "lucide-react";

interface TaskDropdownProps {
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


export const TaskDropdown = ({ tasks, date, isOpen, onClose, position }: TaskDropdownProps) => {
  const [isVisible, setIsVisible] = useState(false);
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


  if (!isOpen || !isVisible) {
    return null;
  }

  // Check if mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  
  return (
    <div
      ref={dropdownRef}
      className={cn(
        "fixed z-50 bg-card border border-border rounded-lg shadow-xl backdrop-blur-sm",
        isMobile ? "mobile-popup" : ""
      )}
      style={isMobile ? {
        maxHeight: '80vh',
        overflowY: 'auto'
      } : {
        left: position.x,
        top: position.y,
        maxWidth: '400px',
        minWidth: '300px',
        maxHeight: '400px',
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
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
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
      <div className="p-2 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.$id}
            onClick={() => handleTaskClick(task.$id)}
            className={cn(
              "p-3 rounded-lg border border-border/50 border-l-4 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 group",
              statusColorMap[task.status]
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm opacity-70 flex-shrink-0">
                  {statusIconMap[task.status]}
                </span>
                <p className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {task.name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 text-sm">
              {task.assignee ? (
                <div className="flex items-center gap-1">
                  <MemberAvatar
                    name={task.assignee.name}
                    className="size-4"
                  />
                  <span className="text-muted-foreground truncate max-w-[80px]">
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
              
              <div className="size-1 rounded-full bg-border/50" />
              
              {task.project ? (
                <div className="flex items-center gap-1">
                  <ProjectAvatar
                    name={task.project.name}
                    className="size-4"
                  />
                  <span className="text-muted-foreground truncate max-w-[80px]">
                    {task.project.name}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="size-4 rounded-md bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">?</span>
                  </div>
                  <span className="text-muted-foreground">No project</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
