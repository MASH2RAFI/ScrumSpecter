import { z } from "zod";

import { preferencesSchema } from "@/features/auth/preferences";

const password = z.string().min(8, "Minimum 8 characters").max(200);

export const profileSchema = z.object({
    name: z.string().trim().min(1, "Required").max(80).optional(),
    email: z.string().trim().email().optional(),
    // Required to change the email
    currentPassword: z.string().optional(),
});

export const passwordSchema = z.object({
    // Omitted only when the account has no password yet (Google-only)
    currentPassword: z.string().optional(),
    newPassword: password,
});

export const deleteAccountSchema = z.object({
    confirmEmail: z.string().trim(),
    password: z.string().optional(),
});

export const preferencesUpdateSchema = preferencesSchema.partial();
