"use client";

import { InboxIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Task } from "../types";
import { IssueCard } from "./issue-card";

interface UnscheduledPanelProps {
    tasks: Task[];
    canSchedule: boolean;
    onOpen: (taskId: string) => void;
    onDragStart: (task: Task) => void;
    onDragEnd: () => void;
    onClose: () => void;
}

// Jira's "Unscheduled work": tasks without a due date, dragged onto the calendar to schedule them
export const UnscheduledPanel = ({ tasks, canSchedule, onOpen, onDragStart, onDragEnd, onClose }: UnscheduledPanelProps) => (
    <aside aria-label="Unscheduled tasks" className="flex w-full flex-col border-t lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
            <p className="flex items-center gap-2 text-sm font-semibold">
                <InboxIcon className="size-4 text-muted-foreground" />
                Unscheduled
                <span className="rounded-full bg-muted px-1.5 text-xs">{tasks.length}</span>
            </p>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Hide unscheduled" onClick={onClose}>
                <XIcon className="size-4" />
            </Button>
        </div>
        {canSchedule && tasks.length > 0 && (
            <p className="px-3 pt-2 text-xs text-muted-foreground">Drag a task onto a day or time to schedule it.</p>
        )}
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-3 max-h-[320px] lg:max-h-[760px]">
            {tasks.length === 0 && (
                <li className="py-6 text-center text-sm text-muted-foreground">Every task has a date.</li>
            )}
            {tasks.map((task) => (
                <li key={task.$id}>
                    <IssueCard
                        task={task}
                        variant="panel"
                        draggable={canSchedule}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onOpen={onOpen}
                    />
                </li>
            ))}
        </ul>
    </aside>
);
