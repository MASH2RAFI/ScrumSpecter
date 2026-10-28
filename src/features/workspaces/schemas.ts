import { z } from "zod";

import { endNotBeforeStart, sprintDatesFields } from "@/features/projects/schemas";

export const createWorkspaceSchema = z.object({
    name: z.string().trim().min(1, "Required"),
});

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const updateWorkspaceSchema = z.object({
    name: z.string().trim().min(1, "Must be 1 or more characters").optional(),
    // Country code for public holidays; "" = none
    holidayCountry: z.string().max(8).optional(),
    workDayStart: z.string().regex(HH_MM, "Use HH:MM").optional(),
    workDayEnd: z.string().regex(HH_MM, "Use HH:MM").optional(),
}).refine(
    ({ workDayStart, workDayEnd }) => !workDayStart || !workDayEnd || workDayStart < workDayEnd,
    { message: "The day has to end after it starts", path: ["workDayEnd"] },
);

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export const holidayRangeSchema = z.object({
    from: z.string().regex(YYYY_MM_DD),
    to: z.string().regex(YYYY_MM_DD),
    includeHidden: z.enum(["true", "false"]).optional(),
}).refine(({ from, to }) => from <= to && Number(to.slice(0, 4)) - Number(from.slice(0, 4)) <= 1, "Range must be within two years");

export const holidayChangeSchema = z.object({
    date: z.string().regex(YYYY_MM_DD, "Pick a date"),
    name: z.string().trim().min(1, "Give it a name").max(80),
    kind: z.enum(["custom", "hidden"]),
});

export const createWorkspaceWithProjectSchema = z.object({
    workspaceName: z.string().trim().min(1, "Workspace name is required"),
    projectName: z.string().trim().min(1, "Project name is required"),
    ...sprintDatesFields,
}).superRefine(endNotBeforeStart);

// Invite link limits: null = never expires / unlimited; a field left out stays as it is
export const inviteLimitsSchema = z.object({
    expiresInDays: z.union([z.literal(1), z.literal(7), z.literal(30)]).nullable().optional(),
    maxUses: z.union([z.literal(1), z.literal(5), z.literal(10), z.literal(25)]).nullable().optional(),
}).refine((limits) => limits.expiresInDays !== undefined || limits.maxUses !== undefined, "Nothing to change");
