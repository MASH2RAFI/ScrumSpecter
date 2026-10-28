import { Task } from "@/features/tasks/types";

export type ChangeRequestKind = "create" | "update" | "delete";
export type ChangeRequestStatus = "pending" | "approved" | "declined";

export type ChangeRequest = {
    $id: string;
    workspaceId: string;
    kind: ChangeRequestKind;
    status: ChangeRequestStatus;
    taskId: string | null;
    taskName: string;
    // create: the new task's fields; update: only the fields that change (dates as ISO strings)
    changes: Partial<Pick<Task, "name" | "projectId" | "assigneeIds" | "description" | "storyPoints" | "status" | "durationMinutes">>
        & { dueDate?: string | null; startAt?: string | null };
    note: string | null;
    requesterId: string;
    requesterName: string;
    reviewerName: string | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
};
