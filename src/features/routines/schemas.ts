import { z } from "zod";

export const routineFieldsSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    description: z.string().optional(),
    projectId: z.string().trim().min(1, "Please select a project"),
    // Every generated task gets all of them
    assigneeIds: z.array(z.string().trim().min(1)).min(1, "Pick at least one assignee").max(20, "At most 20 assignees"),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Pick at least one day"),
    storyPoints: z.number().min(1, "Story points must be at least 1").max(100, "Story points cannot exceed 100").optional(),
    // Optional "HH:MM" in timeZone; null = all-day tasks
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM").nullable().optional(),
    timeZone: z.string().max(64).optional(),
    durationMinutes: z.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours").nullable().optional(),
    // Which task views list its tasks; all of them unless turned off
    showInTable: z.boolean().optional(),
    showInKanban: z.boolean().optional(),
    showInCalendar: z.boolean().optional(),
});

export const createRoutineSchema = routineFieldsSchema.extend({
    workspaceId: z.string().trim().min(1, "Required"),
});

export const updateRoutineSchema = routineFieldsSchema.partial().extend({
    active: z.boolean().optional(),
});
