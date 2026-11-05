import { z } from "zod";

// Text length caps, shared by API validation and form inputs (maxLength)
export const MAX_PERSON_NAME = 80;
export const MAX_WORKSPACE_NAME = 100;
export const MAX_TITLE = 200; // tasks, projects, routines
export const MAX_DESCRIPTION = 5000;
export const MAX_EMAIL = 254;
// Argon2 is slow on purpose; a huge password would tie up the server before any check
export const MAX_PASSWORD = 128;
// Sign-in accepts more, so passwords set before the cap still work
export const MAX_LOGIN_PASSWORD = 1024;
export const MAX_ID = 64;

export const idString = z.string().min(1).max(MAX_ID);

// A real calendar day as YYYY-MM-DD (2026-02-30 has the right shape but isn't one: the database would refuse it with a 500)
export const isoDay = (shapeMessage = "Use YYYY-MM-DD") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, shapeMessage)
    .refine((day) => !Number.isNaN(Date.parse(`${day}T00:00:00Z`)) && new Date(`${day}T00:00:00Z`).toISOString().startsWith(day), "Not a real date");

