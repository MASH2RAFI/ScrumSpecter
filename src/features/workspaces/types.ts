import { Document } from "@/lib/db/types";

export type Workspace = Document & {
    name: string;
    inviteCode: string;
    userId: string;
};