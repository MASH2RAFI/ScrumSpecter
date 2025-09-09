import { Models } from "node-appwrite";

export type Project = Models.Document & {
    name: string;
    workspaceId: string;
    sprintDuration?: number; // in days
    currentSprintStartDate: string;
    currentSprintEndDate: string;
    sprintNumber?: number;
};