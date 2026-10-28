import { getCurrent } from "@/features/auth/queries";
import { redirect } from "next/navigation";
import { WorkspaceIdJoinClient } from "./client";

interface JoinPageProps {
    params: { workspaceId: string; inviteCode: string };
}

const WorkspaceIdJoinPage = async ({ params: { workspaceId, inviteCode } }: JoinPageProps) => {
    const user = await getCurrent();
    // Back to this invite after signing in
    if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/workspaces/${workspaceId}/join/${inviteCode}`)}`);

    return <WorkspaceIdJoinClient />

}

export default WorkspaceIdJoinPage;