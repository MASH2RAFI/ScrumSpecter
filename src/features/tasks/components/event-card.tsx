
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import { ProjectAvatar } from "@/features/projects/components/project-avatar";

import { TaskStatus, PopulatedAssignee, PopulatedProject } from "../types";
import { calendarStatusColorMap, calendarStatusIconMap } from "./calendar-utils";
import { useTaskPanel } from "../hooks/use-task-panel";

interface EventCardProps {
    title: string;
    assignee: PopulatedAssignee | null;
    project: PopulatedProject | null;
    status: TaskStatus;
    id: string;
    // Admins can drag a card onto another day to reschedule it
    draggable?: boolean;
}

export const TASK_DRAG_TYPE = "application/x-scrumspecter-task";

const Placeholder = ({ label }: { label: string }) => (
    <div className="flex items-center gap-1">
        <div className="size-4 rounded-md bg-muted flex items-center justify-center">
            <span className="text-xs text-muted-foreground">?</span>
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);

export const EventCard = ({ title, assignee, project, status, id, draggable }: EventCardProps) => {
    const { open } = useTaskPanel();

    const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        open(id);
    };

    return (
        <div className="px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1.5 lg:py-1.5">
            <div
                onClick={onClick}
                draggable={draggable}
                onDragStart={draggable ? (e) => {
                    e.dataTransfer.setData(TASK_DRAG_TYPE, id);
                    e.dataTransfer.effectAllowed = "move";
                } : undefined}
                title={draggable ? "Drag to another day to reschedule" : undefined}
                className={cn(
                    "p-1 sm:p-2 md:p-3 text-[8px] sm:text-[10px] md:text-xs lg:text-sm bg-card text-foreground border border-border/50 rounded-lg border-l-4 flex flex-col gap-y-0.5 sm:gap-y-1 md:gap-y-2 cursor-pointer hover:shadow-xl transition-all duration-300 group backdrop-blur-sm",
                    "hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5",
                    "hover:border-primary/30 hover:ring-2 hover:ring-primary/10",
                    // min-w-0 + overflow-hidden keep the card inside its day cell
                    "w-full max-w-full min-w-0 overflow-hidden relative z-50",
                    "touch-manipulation active:scale-95 min-h-[32px] sm:min-h-[40px]",
                    calendarStatusColorMap[status]
                )}
            >
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-xs opacity-70 flex-shrink-0">{calendarStatusIconMap[status]}</span>
                        <p className="font-medium text-foreground truncate group-hover:text-primary transition-unified text-xs leading-tight">{title}</p>
                    </div>
                </div>
                <div className="flex items-center gap-x-1.5 min-w-0">
                    {assignee ? (
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            <MemberAvatar name={assignee.name} className="size-4 shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{assignee.name}</span>
                        </div>
                    ) : (
                        <Placeholder label="Unassigned" />
                    )}
                    <div className="size-1 rounded-full bg-border/50 shrink-0" />
                    {project ? (
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                            <ProjectAvatar name={project.name} className="size-4 shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{project.name}</span>
                        </div>
                    ) : (
                        <Placeholder label="No project" />
                    )}
                </div>
            </div>
        </div>
    );
};
