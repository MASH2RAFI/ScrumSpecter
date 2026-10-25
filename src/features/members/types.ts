import { Document } from "@/lib/db/types";

export enum MemberRole {
    ADMIN = "ADMIN",
    MEMBER = "MEMBER",
}

export type Member = Document & {
    workspaceId: string;
    userId: string;
    role: MemberRole;
};
