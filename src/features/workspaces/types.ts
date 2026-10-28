import { Document } from "@/lib/db/types";

export type Workspace = Document & {
    name: string;
    inviteCode: string;
    // Joins people as viewers (read-only)
    viewerInviteCode: string | null;
    userId: string;
    holidayCountry: string | null;
    // "HH:MM"
    workDayStart: string;
    workDayEnd: string;
    inviteExpiresAt: string | null;
    inviteMaxUses: number | null;
    inviteUses: number;
    dataVersion: number;
};