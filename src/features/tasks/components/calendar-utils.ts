import { Task, TaskStatus } from "../types";

export const calendarStatusColorMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "border-l-slate-500 bg-slate-100/80 dark:bg-slate-900/20",
    [TaskStatus.TODO]: "border-l-red-500 bg-red-100/80 dark:bg-red-950/20",
    [TaskStatus.IN_PROGRESS]: "border-l-amber-500 bg-amber-100/80 dark:bg-amber-950/20",
    [TaskStatus.IN_REVIEW]: "border-l-blue-600 bg-blue-100/80 dark:bg-blue-950/20",
    [TaskStatus.DONE]: "border-l-emerald-600 bg-emerald-100/80 dark:bg-emerald-950/20",
};

export const calendarStatusIconMap: Record<TaskStatus, string> = {
    [TaskStatus.BACKLOG]: "📋",
    [TaskStatus.TODO]: "📝",
    [TaskStatus.IN_PROGRESS]: "⚡",
    [TaskStatus.IN_REVIEW]: "👀",
    [TaskStatus.DONE]: "✅",
};

export const NO_PROJECT = "No Project";

// project name -> status -> tasks, in first-seen order
export type TasksByProjectAndStatus = Record<string, Record<string, Task[]>>;

export const groupTasksByProjectAndStatus = (tasks: Task[]): TasksByProjectAndStatus => {
    return tasks.reduce((groups, task) => {
        const projectGroup = (groups[task.project?.name || NO_PROJECT] ??= {});
        (projectGroup[task.status] ??= []).push(task);
        return groups;
    }, {} as TasksByProjectAndStatus);
};

export const pluralize = (count: number, word: string) => `${count} ${word}${count !== 1 ? "s" : ""}`;
