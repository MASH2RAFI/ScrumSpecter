import { z } from "zod";

export const createWorkspaceSchema = z.object ({
    name: z.string().trim().min(1, "Required"),
});

export const updateWorkspaceSchema = z.object ({
    name: z.string().trim().min(1, "Must be 1 or more characters").optional(),
});

export const createWorkspaceWithProjectSchema = z.object({
    workspaceName: z.string().trim().min(1, "Workspace name is required"),
    projectName: z.string().trim().min(1, "Project name is required"),
    sprintDuration: z.number().min(1, "Sprint duration must be at least 1 day").max(30, "Sprint duration cannot exceed 30 days"),
    startingSprintDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format").min(1, "Starting sprint date is required"),
});
