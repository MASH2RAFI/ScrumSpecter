import { redirect } from "next/navigation";

interface SettingsPageProps {
    params: { workspaceId: string };
}

// Settings is a popup now; keep old links working
const SettingsPage = ({ params: { workspaceId } }: SettingsPageProps) => {
    redirect(`/workspaces/${workspaceId}?workspace-panel=settings`);
};

export default SettingsPage;
