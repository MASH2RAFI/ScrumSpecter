import { z } from "zod";

import { endNotBeforeStart, sprintDatesFields } from "@/features/projects/schemas";

export const createWorkspaceSchema = z.object({
    name: z.string().trim().min(1, "Required"),
});

export const updateWorkspaceSchema = z.object({
    name: z.string().trim().min(1, "Must be 1 or more characters").optional(),
});

export const createWorkspaceWithProjectSchema = z.object({
    workspaceName: z.string().trim().min(1, "Workspace name is required"),
    projectName: z.string().trim().min(1, "Project name is required"),
    ...sprintDatesFields,
}).superRefine(endNotBeforeStart);
