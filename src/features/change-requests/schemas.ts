import { z } from "zod";

import { idString } from "@/lib/limits";

import { createTaskSchema } from "@/features/tasks/schemas";

// A new task: everything the task form asks for (the status defaults to To Do)
export const proposedTaskSchema = createTaskSchema.omit({ workspaceId: true }).extend({
    status: createTaskSchema.shape.status.optional(),
});

// Changes to a task: any of its details except the status, which has its own rules
export const proposedChangesSchema = createTaskSchema
    .omit({ workspaceId: true, status: true })
    .partial()
    .refine((changes) => Object.values(changes).some((value) => value !== undefined), "Change at least one thing");

const note = z.string().trim().max(1000).optional();

export const createChangeRequestSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("create"), workspaceId: idString, changes: proposedTaskSchema, note }),
    z.object({ kind: z.literal("update"), taskId: idString, changes: proposedChangesSchema, note }),
    z.object({ kind: z.literal("delete"), taskId: idString, note }),
]);

export const reviewChangeRequestSchema = z.object({ note: z.string().trim().max(1000).optional() });
