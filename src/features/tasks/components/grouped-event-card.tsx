"use client";

import { ChevronRightIcon } from "lucide-react";

import { Task } from "../types";
import { NO_PROJECT, pluralize } from "./calendar-utils";

interface GroupedEventCardProps {
    tasks: Task[];
    date: Date;
    onMultipleTasksClick: (tasks: Task[], date: Date, event: React.MouseEvent) => void;
}

// Collapsed summary for a day with several tasks; clicking opens the MultipleTasksPopup.
export const GroupedEventCard = ({ tasks, date, onMultipleTasksClick }: GroupedEventCardProps) => {
    if (!tasks || tasks.length === 0) {
        return null;
    }

    const projectCount = new Set(tasks.map((task) => task.project?.name || NO_PROJECT)).size;

    return (
        <div className="px-0.5 py-0.5 sm:px-1 sm:py-1 lg:px-1.5 lg:py-1.5">
            <div className="bg-card border border-border/50 rounded-lg border-l-4 border-l-blue-500 shadow-lg transition-all duration-300 hover:shadow-2xl backdrop-blur-sm hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5 hover:border-primary/30 hover:ring-2 hover:ring-primary/10 w-full max-w-full relative z-50">
                <div
                    className="p-2 cursor-pointer hover:bg-muted/20 transition-unified"
                    onClick={(e) => onMultipleTasksClick(tasks, date, e)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1">
                                <ChevronRightIcon className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-semibold text-foreground">
                                    {pluralize(tasks.length, "task")}
                                </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {pluralize(projectCount, "project")}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
