import { z } from "zod";

export const createPlaceholderSchema = z.object({
    workspaceId: z.string().min(1),
    name: z.string().trim().min(1, "Give the placeholder a name").max(60),
    // When someone with this email joins, the placeholder's tasks become theirs
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export const replacePlaceholderSchema = z.object({
    memberId: z.string().min(1),
});
