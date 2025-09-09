import { DATABASE_ID, MEMBERS_ID } from "@/config";
import { Databases, Query } from "node-appwrite";
import { MemberRole } from "./types";

interface GetMemberProps{
    databases: Databases;
    workspaceId: string;
    userId: string; 
};

export const getMember = async ({
    databases,
    workspaceId,
    userId,
}: GetMemberProps) => {
    const members = await databases. listDocuments(
        DATABASE_ID,
        MEMBERS_ID, 
        [
            Query. equal ("workspaceId", workspaceId),
            Query.equal("userId", userId)
        ]
    )

    return members.documents[0]
};

export const isAdmin = async ({
    databases,
    workspaceId,
    userId,
}: GetMemberProps): Promise<boolean> => {
    const member = await getMember({
        databases,
        workspaceId,
        userId,
    });
    
    return member?.role === MemberRole.ADMIN;
};