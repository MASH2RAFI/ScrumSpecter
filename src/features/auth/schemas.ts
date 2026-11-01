import { z } from "zod";

import { MAX_EMAIL, MAX_LOGIN_PASSWORD, MAX_PASSWORD, MAX_PERSON_NAME } from "@/lib/limits";

export const loginSchema = z.object({
    email: z.string().max(MAX_EMAIL).email(),
    password: z.string().min(8, "Minimum 8 characters").max(MAX_LOGIN_PASSWORD),
});

export const registerSchema = z.object({
    name: z.string().trim().min(1, "Required").max(MAX_PERSON_NAME, `At most ${MAX_PERSON_NAME} characters`),
    email: z.string().max(MAX_EMAIL).email(),
    password: z.string().min(8, "Minimum 8 characters").max(MAX_PASSWORD, `At most ${MAX_PASSWORD} characters`),
});
