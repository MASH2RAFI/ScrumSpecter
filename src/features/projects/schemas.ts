import { z } from "zod";

import { sprintLengthInDays } from "@/lib/sprint-utils";

const DD_MM_YYYY = /^\d{2}\/\d{2}\/\d{4}$/;

// Sprint start/end as picked in the forms (DD/MM/YYYY); any length, but the end can't precede the start
export const sprintDatesFields = {
    currentSprintStartDate: z.string().regex(DD_MM_YYYY, "Start date is required"),
    currentSprintEndDate: z.string().regex(DD_MM_YYYY, "End date is required"),
};

export const endNotBeforeStart = (
    { currentSprintStartDate, currentSprintEndDate }: { currentSprintStartDate: string; currentSprintEndDate: string },
    ctx: z.RefinementCtx,
) => {
    if (DD_MM_YYYY.test(currentSprintStartDate) && DD_MM_YYYY.test(currentSprintEndDate)
        && sprintLengthInDays(currentSprintStartDate, currentSprintEndDate) < 1) {
        ctx.addIssue({ code: "custom", path: ["currentSprintEndDate"], message: "End date can't be before the start date" });
    }
};

// Create and edit project forms
export const projectFormSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    ...sprintDatesFields,
}).superRefine(endNotBeforeStart);

// API inputs (multipart form fields; dates as YYYY-MM-DD)
const apiEndNotBeforeStart = (
    { currentSprintStartDate, currentSprintEndDate }: { currentSprintStartDate?: string; currentSprintEndDate?: string },
    ctx: z.RefinementCtx,
) => {
    if (currentSprintStartDate && currentSprintEndDate && currentSprintEndDate < currentSprintStartDate) {
        ctx.addIssue({ code: "custom", path: ["currentSprintEndDate"], message: "End date can't be before the start date" });
    }
};

export const createProjectFormSchema = z.object({
    name: z.string().trim().min(1, "Required"),
    workspaceId: z.string(),
    sprintDuration: z.string().optional().transform((val) => val ? Number(val) : undefined),
    currentSprintStartDate: z.string().optional(),
    currentSprintEndDate: z.string().optional(),
    sprintNumber: z.string().default("1").transform((val) => Number(val)), // Automatically set to 1
}).superRefine(apiEndNotBeforeStart);

export const updateProjectFormSchema = z.object({
    name: z.string().trim().min(1, "Minimum 1 character required").optional(),
    workspaceId: z.string(),
    sprintDuration: z.string().optional().transform((val) => val ? Number(val) : undefined),
    currentSprintStartDate: z.string().optional(),
    currentSprintEndDate: z.string().optional(),
    sprintNumber: z.string().optional().transform((val) => val ? Number(val) : undefined),
}).superRefine(apiEndNotBeforeStart);
