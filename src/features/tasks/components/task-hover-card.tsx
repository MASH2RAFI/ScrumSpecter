"use client";

import { cloneElement, useEffect, useRef, useState, type ReactElement } from "react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { snakeCaseToTitleCase } from "@/lib/utils";

import { Task } from "../types";
import { TaskDate } from "./task-date";

const SHOW_DELAY_MS = 500;

// A read-only preview of a card, shown after the mouse rests on it. Not for touch (a tap opens the
// task) and never while pressing or dragging. The preview ignores the pointer, so it can't be
// reached or clicked: moving off the card closes it.
export const TaskHoverCard = ({ task, children }: { task: Task; children: ReactElement<React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }> }) => {
    const [open, setOpen] = useState(false);
    const card = useRef<HTMLElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
    const hide = () => {
        clearTimeout(timer.current);
        setOpen(false);
    };
    useEffect(() => () => clearTimeout(timer.current), []);

    const people = task.assignees?.map((assignee) => assignee.name).join(", ");

    // The popover is only mounted while open: a board has hundreds of cards and one preview at a time
    return (
        <>
            {cloneElement(children, {
                ref: card,
                onPointerEnter: (event: React.PointerEvent<HTMLElement>) => {
                    if (event.pointerType !== "mouse") return;
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
                },
                onPointerLeave: hide,
                onPointerDown: hide,
            })}
            {open && (
            <Popover open>
                <PopoverAnchor virtualRef={card} />
                <PopoverContent
                    side="right"
                    align="start"
                    className="pointer-events-none w-80 space-y-2 p-3 text-sm"
                    data-testid="task-hover-card"
                    onOpenAutoFocus={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => event.preventDefault()}
                >
                    <p className="font-medium break-words">{task.name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <Badge variant={task.status}>{snakeCaseToTitleCase(task.status)}</Badge>
                        <span>{task.storyPoints} {task.storyPoints === 1 ? "point" : "points"}</span>
                        <TaskDate value={task.dueDate} startAt={task.startAt} durationMinutes={task.durationMinutes} className="text-xs" />
                    </div>
                    <p className="text-xs text-muted-foreground">{task.project?.name ?? "No project"} · {people || "Unassigned"}</p>
                    {task.description && (
                        <p className="line-clamp-6 whitespace-pre-wrap break-words text-xs">{task.description}</p>
                    )}
                </PopoverContent>
            </Popover>
            )}
        </>
    );
};
