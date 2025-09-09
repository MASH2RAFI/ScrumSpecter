import { z } from "zod";

export const createProjectSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    workspaceId: z.string(),
    sprintDuration: z.number().min(1, "Sprint duration must be at least 1 day").max(30, "Sprint duration cannot exceed 30 days").optional(),
    startingSprintDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format").optional(),
    currentSprintStartDate: z.string().optional(),
    currentSprintEndDate: z.string().optional(),
    sprintNumber: z.number().min(1, "Sprint number must be at least 1").optional(),
});

export const createProjectFormSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    workspaceId: z.string(),
    sprintDuration: z.string().optional().transform((val) => val ? Number(val) : undefined),
    startingSprintDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format").optional(),
    currentSprintStartDate: z.string().optional(),
    currentSprintEndDate: z.string().optional(),
    sprintNumber: z.string().default("1").transform((val) => Number(val)), // Automatically set to 1
});

export const updateProjectSchema = z.object({
    name: z.string().trim().min(1, "Minimum 1 character required").optional(),
    workspaceId: z.string(),
    sprintDuration: z.number().min(1, "Sprint duration must be at least 1 day").max(30, "Sprint duration cannot exceed 30 days").optional(),
    startingSprintDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format").optional(),
    currentSprintStartDate: z.string().optional(),
    currentSprintEndDate: z.string().optional(),
    sprintNumber: z.number().min(1, "Sprint number must be at least 1").optional(),
});

export const updateProjectFormSchema = z.object({
    name: z.string().trim().min(1, "Minimum 1 character required").optional(),
    workspaceId: z.string(),
    sprintDuration: z.string().optional().transform((val) => val ? Number(val) : undefined),
    startingSprintDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date must be in DD/MM/YYYY format").optional(),
    currentSprintStartDate: z.string().optional(),
    currentSprintEndDate: z.string().optional(),
    // sprintNumber is not included in form schema as it's automatically managed
});