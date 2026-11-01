import { z } from "zod";

import { idString } from "@/lib/limits";

export const createPlaceholderSchema = z.object({
    workspaceId: idString,
    name: z.string().trim().min(1, "Give the placeholder a name").max(60),
    // When someone with this email joins, the placeholder's tasks become theirs
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
});

export const replacePlaceholderSchema = z.object({
    memberId: idString,
});
