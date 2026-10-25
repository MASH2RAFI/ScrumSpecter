import { Task } from "./types";

// Table and kanban show routine tasks only this far ahead; the calendar shows the whole sprint
export const ROUTINE_LIST_DAYS = 7;

// Keeps every ordinary task and routine tasks due before the end of the 7-day window (today + 6)
export const splitByRoutineWindow = (tasks: Task[], now = new Date()) => {
    const limit = new Date(now);
    limit.setHours(0, 0, 0, 0);
    limit.setDate(limit.getDate() + ROUTINE_LIST_DAYS);

    const visible: Task[] = [];
    let hidden = 0;
    for (const task of tasks) {
        if (task.routineId && task.dueDate && new Date(task.dueDate) >= limit) {
            hidden++;
        } else {
            visible.push(task);
        }
    }
    return { visible, hidden };
};
