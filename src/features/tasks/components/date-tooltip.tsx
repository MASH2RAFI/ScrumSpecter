import React from "react";
import { format } from "date-fns";
import { Task } from "../types";
import { EventCard } from "./event-card";
import { cn } from "@/lib/utils";

interface DateTooltipProps {
    date: Date;
    tasks: Task[];
    isVisible: boolean;
    position: { x: number; y: number };
    onClose: () => void;
}

export const DateTooltip: React.FC<DateTooltipProps> = ({
    date,
    tasks,
    isVisible,
    position,
    onClose
}) => {
    if (!isVisible || tasks.length === 0) return null;

    const dateString = format(date, "EEEE, MMMM d, yyyy");
    const tasksForDate = tasks.filter(task => {
        const taskDate = new Date(task.dueDate);
        return taskDate.toDateString() === date.toDateString();
    });

    return (
        <div
            className={cn(
                "fixed z-50 bg-background border border-border rounded-unified-lg shadow-unified-lg p-4 max-w-sm",
                "transition-all duration-200 ease-out",
                isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
            style={{
                left: position.x,
                top: position.y,
                transform: "translate(-50%, -100%)"
            }}
            onMouseLeave={onClose}
        >
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm">
                        {dateString}
                    </h3>
                    <div className="text-xs text-muted-foreground">
                        {tasksForDate.length} task{tasksForDate.length !== 1 ? 's' : ''}
                    </div>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {tasksForDate.map((task) => (
                        <div key={task.$id} className="transform scale-90">
                            <EventCard
                                id={task.$id}
                                title={task.name}
                                assignee={task.assignee || null}
                                project={task.project || null}
                                status={task.status}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
