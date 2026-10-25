import { Document } from "@/lib/db/types";

export type Project = Document & {
    name: string;
    workspaceId: string;
    sprintDuration?: number; // in days
    currentSprintStartDate: string;
    currentSprintEndDate: string;
    sprintNumber?: number;
};