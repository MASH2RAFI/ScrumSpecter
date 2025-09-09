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
    storyPoints: z.number().min(0, "Story points cannot be negative").max(100, "Story points cannot exceed 100").optional(),
});