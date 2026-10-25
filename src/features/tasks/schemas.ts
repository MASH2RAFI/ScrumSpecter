import { z } from "zod";

import { TaskStatus } from "./types";

export const createTaskSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    status: z.nativeEnum(TaskStatus, { error: "Required" }),
    workspaceId: z.string().trim().min(1, "Required"),
    projectId: z.string().trim().min(1, "Required"),
    dueDate: z.coerce.date().optional(),
    assigneeId: z.string().trim().min(1, "Required"),
    description: z.string().optional(),
    storyPoints: z.number().min(1, "Story points must be at least 1").max(100, "Story points cannot exceed 100").optional(),
    // Optional time block (ISO instant); null clears it back to an all-day task
    startAt: z.iso.datetime({ offset: true }).nullable().optional(),
    durationMinutes: z.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours").nullable().optional(),
});