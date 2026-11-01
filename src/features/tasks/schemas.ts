import { z } from "zod";

import { idString, MAX_DESCRIPTION, MAX_ID, MAX_TITLE } from "@/lib/limits";

import { TaskStatus } from "./types";

export const createTaskSchema = z.object({
    name: z.string().trim().min(1, "Required").max(MAX_TITLE, `At most ${MAX_TITLE} characters`),
    status: z.nativeEnum(TaskStatus, { error: "Required" }),
    workspaceId: idString,
    projectId: z.string().trim().min(1, "Required").max(MAX_ID),
    // null clears it (z.coerce alone would turn null into 1 Jan 1970)
    dueDate: z.coerce.date().nullable().optional(),
    // One or more people (or placeholders)
    assigneeIds: z.array(idString).min(1, "Pick at least one assignee").max(20, "At most 20 assignees"),
    description: z.string().max(MAX_DESCRIPTION, `At most ${MAX_DESCRIPTION} characters`).optional(),
    storyPoints: z.number().min(1, "Story points must be at least 1").max(100, "Story points cannot exceed 100").optional(),
    // Optional time block (ISO instant); null clears it back to an all-day task
    startAt: z.iso.datetime({ offset: true }).nullable().optional(),
    durationMinutes: z.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours").nullable().optional(),
});
export const bulkEditSchema = z.object({
    ids: z.array(idString).min(1).max(200),
    changes: z.union([
        z.object({ delete: z.literal(true) }).strict(),
        z.object({
            status: z.nativeEnum(TaskStatus).optional(),
            // Replaces the assignees of every selected task
            assigneeIds: z.array(idString).min(1).max(20).optional(),
            // ISO date; null clears it
            dueDate: z.iso.datetime({ offset: true }).nullable().optional(),
        }).strict(),
    ]),
});

// Snapshots returned by /bulk-edit or a single delete, sent back to undo it
export const restoreTasksSchema = z.object({
    tasks: z.array(z.object({
        $id: idString,
        name: z.string().trim().min(1).max(MAX_TITLE),
        status: z.nativeEnum(TaskStatus),
        workspaceId: idString,
        projectId: idString,
        assigneeIds: z.array(idString).max(20).default([]),
        description: z.string().max(MAX_DESCRIPTION).nullable().optional(),
        storyPoints: z.number().int().min(1).max(100).nullable().optional(),
        position: z.number().int().min(0).max(10_000_000),
        dueDate: z.string().max(64).nullable().optional(),
        startAt: z.string().max(64).nullable().optional(),
        durationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
        sprintId: z.string().max(MAX_ID).nullable().optional(),
        routineId: z.string().max(MAX_ID).nullable().optional(),
    })).min(1).max(200),
});
