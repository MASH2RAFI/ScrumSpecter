"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { useWorkspaceId } from "@/features/workspaces/hooks/use-workspace-id";
import { Task } from "../types";
import { useDismiss } from "../hooks/use-dismiss";
import { calendarStatusColorMap, calendarStatusIconMap, pluralize } from "./calendar-utils";
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

export const TaskDropdown = ({ tasks, date, isOpen, onClose, position }: TaskDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const workspaceId = useWorkspaceId();

  useDismiss(dropdownRef, isOpen, onClose);

  const handleTaskClick = (taskId: string) => {
    if (taskId && workspaceId) {
      router.push(`/workspaces/${workspaceId}/tasks/${taskId}`);
      onClose();
    }
  };

  if (!isOpen) {
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
              {pluralize(tasks.length, "task")}
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
              calendarStatusColorMap[task.status]
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="text-sm opacity-70 flex-shrink-0">
                  {calendarStatusIconMap[task.status]}
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
