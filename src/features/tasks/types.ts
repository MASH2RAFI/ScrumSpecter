import { Document } from "@/lib/db/types";

export enum TaskStatus {
    BACKLOG = "BACKLOG",
    TODO = "TODO",
    IN_PROGRESS = "IN_PROGRESS",
    IN_REVIEW = "IN_REVIEW",
    DONE = "DONE",
}

// Type for populated assignee data from server
export type PopulatedAssignee = Document & {
    name: string;
    email: string;
    userId?: string;
    workspaceId?: string;
    role?: string;
};

// Type for populated project data from server
export type PopulatedProject = Document & {
    name: string;
    workspaceId?: string;
    sprintDuration?: number;
    sprintNumber?: number;
    startingSprintDate?: string;
    currentSprintStartDate?: string;
    currentSprintEndDate?: string;
};

export type Task = Document & {
    name: string;
    status: TaskStatus;
    workspaceId: string;
    assigneeId: string | null; // Allow null for unassigned tasks
    projectId: string;
    position: number;
    dueDate: string;
    description?: string;
    storyPoints: number;
    sprintId?: string;
    // Optional time block; null/absent = all-day task on dueDate
    startAt?: string | null;
    durationMinutes?: number | null;
    // Set when the task was created by a weekly routine
    routineId?: string | null;
    // Populated fields from server - using proper types to match actual server response
    assignee?: PopulatedAssignee | null;
    project?: PopulatedProject | null;
};