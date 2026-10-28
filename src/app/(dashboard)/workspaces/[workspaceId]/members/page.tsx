import { redirect } from "next/navigation";

interface MembersPageProps {
    params: { workspaceId: string };
}

// Members is a popup now; keep old links working
const MembersPage = ({ params: { workspaceId } }: MembersPageProps) => {
    redirect(`/workspaces/${workspaceId}?workspace-panel=members`);
};

export default MembersPage;
