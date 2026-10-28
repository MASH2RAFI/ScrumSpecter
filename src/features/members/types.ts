import { Document } from "@/lib/db/types";

// What each role may do is in permissions.ts
export enum MemberRole {
    ADMIN = "ADMIN",
    SUPERVISOR = "SUPERVISOR",
    REVIEWER = "REVIEWER",
    ASSIGNEE = "ASSIGNEE",
    VIEWER = "VIEWER",
}

export type Member = Document & {
    workspaceId: string;
    // null for a placeholder (someone who hasn't joined yet)
    userId: string | null;
    role: MemberRole;
    placeholderName: string | null;
    placeholderEmail: string | null;
    isPlaceholder: boolean;
};
