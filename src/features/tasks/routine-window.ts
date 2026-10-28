import { DEFAULT_WEEK_START, weekRange, type WeekStart } from "@/lib/week";

import { Task, TaskStatus } from "./types";

// Home and the list views show routine tasks only for the current week (Saturday start by
// default), and not once they're done; the calendar shows them all. Ordinary tasks are never
// filtered.
export const splitByRoutineWeek = (tasks: Task[], weekStart: WeekStart = DEFAULT_WEEK_START, now = new Date()) => {
    const { start, end } = weekRange(now, weekStart);

    const visible: Task[] = [];
    let hidden = 0;
    for (const task of tasks) {
        const due = task.routineId && task.dueDate ? new Date(task.dueDate) : null;
        if (due && (due < start || due >= end || task.status === TaskStatus.DONE)) {
            hidden++;
        } else {
            visible.push(task);
        }
    }
    return { visible, hidden };
};
