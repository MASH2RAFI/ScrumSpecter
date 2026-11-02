import { redirect } from "next/navigation";

interface MembersPageProps {
    params: Promise<{ workspaceId: string }>;
}

// Members is a popup now; keep old links working
const MembersPage = async (props: MembersPageProps) => {
    const params = await props.params;

    const {
        workspaceId
    } = params;

    redirect(`/workspaces/${workspaceId}?workspace-panel=members`);
};

export default MembersPage;
