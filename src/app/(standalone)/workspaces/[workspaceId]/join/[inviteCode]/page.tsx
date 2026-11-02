import { getCurrent } from "@/features/auth/queries";
import { redirect } from "next/navigation";
import { WorkspaceIdJoinClient } from "./client";

interface JoinPageProps {
    params: Promise<{ workspaceId: string; inviteCode: string }>;
}

const WorkspaceIdJoinPage = async (props: JoinPageProps) => {
    const params = await props.params;

    const {
        workspaceId,
        inviteCode
    } = params;

    const user = await getCurrent();
    // Back to this invite after signing in
    if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/workspaces/${workspaceId}/join/${inviteCode}`)}`);

    return <WorkspaceIdJoinClient />
}

export default WorkspaceIdJoinPage;